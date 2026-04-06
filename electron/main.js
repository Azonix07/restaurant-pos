const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const SERVER_PORT = 5001;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

// Persistent paths inside the OS user-data directory
const userDataPath = app.getPath('userData');
const mongoDataPath = path.join(userDataPath, 'mongodb-data');
const mongoBinPath = path.join(userDataPath, 'mongodb-bin');
const firstRunFlag = path.join(userDataPath, '.pos-initialized');
const logFilePath = path.join(userDataPath, 'pos-startup.log');

// Simple log-to-file for diagnostics (especially on Windows where there's no console)
function logToFile(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(logFilePath, line); } catch (_) {}
}

let mainWindow = null;
let splashWindow = null;
let backendProcess = null;
let mongod = null;

// Startup state tracking
let startupState = { phase: 'init', detail: '', error: null, mongoUri: '' };
let backendRestartCount = 0;
const MAX_BACKEND_RESTARTS = 3;

// Prevent multiple instances — avoids port conflicts from duplicate launches
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function resolvePath(...segments) {
  return app.isPackaged
    ? path.join(process.resourcesPath, ...segments)
    : path.join(__dirname, '..', ...segments);
}

function resolveLocal(file) {
  // __dirname works in both dev and packaged (asar) mode — Electron reads from asar transparently
  return path.join(__dirname, file);
}

/** Kill any process listening on a given port (cleanup from previous crash). */
function freePort(port) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
        if (!err && stdout && stdout.trim()) {
          const pids = [...new Set(
            stdout.trim().split('\n')
              .map(l => l.trim().split(/\s+/).pop())
              .filter(p => /^\d+$/.test(p) && p !== '0')
          )];
          let remaining = pids.length;
          if (remaining === 0) return resolve();
          pids.forEach(pid => {
            exec(`taskkill /f /pid ${pid}`, () => {
              if (--remaining <= 0) resolve();
            });
          });
        } else resolve();
      });
    } else {
      exec(`lsof -ti:${port}`, (err, stdout) => {
        if (!err && stdout && stdout.trim()) {
          const pids = stdout.trim().split('\n').join(' ');
          exec(`kill -9 ${pids}`, () => resolve());
        } else resolve();
      });
    }
  });
}

/** Send a status update to the splash window (if open). */
function splashStatus(text, pct) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents
      .executeJavaScript(`updateStatus("${text}", ${pct})`)
      .catch(() => {});
  }
}

/** Send startup status to the main window (for loading.html). */
function sendStartupStatus(phase, detail = '', error = null) {
  startupState.phase = phase;
  startupState.detail = detail;
  startupState.error = error;
  logToFile(`[Status] ${phase}: ${detail}${error ? ' ERROR: ' + error : ''}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('startup-status', { phase, detail, error });
  }
}

// ---------------------------------------------------------------------------
// Splash / loading window  (receives real progress via splashStatus)
// ---------------------------------------------------------------------------
function showSplash() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 360,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    backgroundColor: '#4f46e5',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  splashWindow.loadFile(resolveLocal('splash.html'));
  splashWindow.center();
}

// ---------------------------------------------------------------------------
// Embedded MongoDB
// ---------------------------------------------------------------------------
async function startMongoDB() {
  ensureDir(mongoDataPath);
  ensureDir(mongoBinPath);

  process.env.MONGOMS_DOWNLOAD_DIR = mongoBinPath;
  process.env.MONGOMS_SYSTEM_BINARY = '';       // always use downloaded binary
  process.env.MONGOMS_VERSION = '7.0.14';

  const { MongoMemoryServer } = require('mongodb-memory-server-core');

  mongod = await MongoMemoryServer.create({
    instance: {
      port: 27099,
      dbPath: mongoDataPath,
      storageEngine: 'wiredTiger',
    },
    binary: {
      version: '7.0.14',
      downloadDir: mongoBinPath,
    },
  });

  return mongod.getUri();
}

// ---------------------------------------------------------------------------
// Database seed (idempotent)
// ---------------------------------------------------------------------------
function runSeed(mongoUri) {
  return new Promise((resolve) => {
    const seedPath = resolvePath('backend', 'src', 'seed.js');
    const cwd = resolvePath('backend');
    const child = spawn(process.execPath, [seedPath], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', MONGODB_URI: mongoUri, USER_DATA_PATH: userDataPath },
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => console.log('[Seed]', d.toString().trim()));
    child.stderr.on('data', (d) => console.error('[Seed]', d.toString().trim()));
    child.on('close', () => resolve());
    child.on('error', () => resolve());
  });
}

// ---------------------------------------------------------------------------
// Backend Express server
// ---------------------------------------------------------------------------
function startBackend(mongoUri) {
  return new Promise((resolve) => {
    const serverPath = resolvePath('backend', 'src', 'server.js');
    const cwd = resolvePath('backend');

    logToFile(`Backend serverPath: ${serverPath}`);
    logToFile(`Backend cwd: ${cwd}`);
    logToFile(`Backend mongoUri: ${mongoUri}`);

    backendProcess = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: String(SERVER_PORT),
        MONGODB_URI: mongoUri,
        NODE_ENV: 'production',
        USER_DATA_PATH: userDataPath,
      },
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let resolved = false;
    backendProcess.stdout.on('data', (data) => {
      const text = data.toString();
      console.log('[Backend]', text.trim());
      logToFile(`[Backend stdout] ${text.trim()}`);
      if (!resolved && text.includes('Server Running')) {
        resolved = true;
        resolve();
      }
    });

    backendProcess.stderr.on('data', (d) => {
      const text = d.toString().trim();
      console.error('[Backend]', text);
      logToFile(`[Backend stderr] ${text}`);
    });

    backendProcess.on('error', (err) => {
      console.error('[Backend] Spawn error:', err.message);
      logToFile(`[Backend spawn error] ${err.message}`);
      if (!resolved) { resolved = true; resolve(); }
    });

    backendProcess.on('exit', (code) => {
      console.log('[Backend] Exited with code', code);
      logToFile(`[Backend exit] code=${code}`);
      const deadProcess = backendProcess;
      backendProcess = null;
      if (!resolved) { resolved = true; resolve(); }

      // Auto-restart backend if it crashed unexpectedly
      if (code !== 0 && startupState.mongoUri && backendRestartCount < MAX_BACKEND_RESTARTS) {
        backendRestartCount++;
        logToFile(`[Backend] Auto-restarting (attempt ${backendRestartCount}/${MAX_BACKEND_RESTARTS})`);
        sendStartupStatus('restarting', `Server crashed, restarting (${backendRestartCount}/${MAX_BACKEND_RESTARTS})...`);
        setTimeout(async () => {
          await startBackend(startupState.mongoUri);
          const ready = await waitForServer(10, 2000);
          if (ready) {
            sendStartupStatus('ready', 'Server is running');
          } else {
            sendStartupStatus('error', 'Server failed to start', 'Backend process exited unexpectedly');
          }
        }, 2000);
      }
    });

    // Safety timeout
    setTimeout(() => { if (!resolved) { resolved = true; resolve(); } }, 25000);
  });
}

// ---------------------------------------------------------------------------
// Quick health probe (single attempt, 2s timeout)
// ---------------------------------------------------------------------------
function healthCheck() {
  return new Promise((resolve) => {
    const req = http.get(`${SERVER_URL}/api/health`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

async function waitForServer(retries = 5, interval = 1500) {
  for (let i = 0; i < retries; i++) {
    if (await healthCheck()) return true;
    if (i < retries - 1) await new Promise(r => setTimeout(r, interval));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main application window
// ---------------------------------------------------------------------------
function createMainWindow(serverReady) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Restaurant POS',
    icon: path.join(__dirname, 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    backgroundColor: '#f5f7fa',
  });

  if (serverReady) {
    // Server is healthy — load the app directly
    mainWindow.loadURL(SERVER_URL);
  } else {
    // Server isn't ready yet — show loading.html which auto-retries
    mainWindow.loadFile(resolveLocal('loading.html'));
  }

  // Inject SERVER_URL on every page load (works for both loading.html → redirect and direct load)
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents
      .executeJavaScript(`window.SERVER_URL = "${SERVER_URL}";`)
      .catch(() => {});
  });

  // Show the main window and close splash once content has painted
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow.isVisible()) {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  showSplash();

  let mongoUri = '';
  let serverReady = false;

  try {
    // 0. Initialize log & free ports from any crashed previous instance
    fs.writeFileSync(logFilePath, `=== POS Startup ${new Date().toISOString()} ===\n`);
    logToFile(`Platform: ${process.platform}, Arch: ${process.arch}`);
    logToFile(`userData: ${userDataPath}`);
    logToFile(`resourcesPath: ${process.resourcesPath}`);
    logToFile(`isPackaged: ${app.isPackaged}`);
    splashStatus('Preparing', 5);
    await freePort(SERVER_PORT);
    await freePort(27099);

    // 1. Start embedded MongoDB
    splashStatus('Starting database', 10);
    console.log('[Startup] Starting embedded MongoDB...');
    try {
      mongoUri = await startMongoDB();
      startupState.mongoUri = mongoUri;
    } catch (mongoErr) {
      const msg = mongoErr.message || String(mongoErr);
      logToFile(`[MongoDB Error] ${msg}`);
      // Check if it's a download error (first run without internet)
      if (msg.includes('download') || msg.includes('fetch') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
        splashStatus('Database download failed', 30);
        startupState.error = 'MongoDB binary download failed. Please check your internet connection for the first run.';
      } else {
        splashStatus('Database error', 30);
        startupState.error = `Database failed to start: ${msg}`;
      }
      throw mongoErr;
    }
    logToFile(`MongoDB URI: ${mongoUri}`);
    splashStatus('Database ready', 35);

    // 2. Seed on first run
    const isFirstRun = !fs.existsSync(firstRunFlag);
    if (isFirstRun) {
      splashStatus('Setting up first run', 40);
      console.log('[Startup] First run — seeding...');
      await runSeed(mongoUri);
      fs.writeFileSync(firstRunFlag, new Date().toISOString());
    }

    // 3. Start backend
    splashStatus('Starting server', 50);
    console.log('[Startup] Starting backend...');
    await startBackend(mongoUri);
    splashStatus('Server started', 75);

    // 4. Wait for server with retries (more generous: 12 retries × 2s = 24s)
    serverReady = await waitForServer(12, 2000);
    logToFile(`Server ready: ${serverReady}`);
    splashStatus(serverReady ? 'Ready' : 'Finishing up', 95);

    if (serverReady) {
      startupState.phase = 'ready';
    }
  } catch (err) {
    console.error('[Startup] Error:', err);
    logToFile(`[Startup error] ${err.stack || err.message || err}`);
    if (!startupState.error) {
      startupState.error = err.message || 'Unknown startup error';
    }
  }

  // 5. Open the main window immediately — it will either load the app
  //    or show loading.html which polls until the server is up
  createMainWindow(serverReady);

  // If loading.html was shown, send startup state once it's loaded
  if (!serverReady && mainWindow) {
    mainWindow.webContents.on('did-finish-load', () => {
      if (startupState.error) {
        sendStartupStatus('error', startupState.error, startupState.error);
      } else if (startupState.mongoUri && !backendProcess) {
        sendStartupStatus('error', 'Server process exited', 'Backend process is not running');
      } else if (startupState.mongoUri) {
        sendStartupStatus('connecting', 'Server is starting, waiting for it to be ready...');
      } else {
        sendStartupStatus('starting-db', 'Starting database...');
      }
    });
  }

  // 6. Initialize auto-updater (only in packaged builds)
  if (app.isPackaged && mainWindow) {
    try {
      const { initAutoUpdater } = require('./updater');
      initAutoUpdater(mainWindow);
    } catch (err) {
      logToFile(`[Updater] Failed to initialize: ${err.message}`);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow(true);
});

app.on('before-quit', () => {
  if (backendProcess) {
    try {
      // On Windows, child processes need SIGTERM or taskkill
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(backendProcess.pid), '/f', '/t']);
      } else {
        backendProcess.kill();
      }
    } catch (_) {}
    backendProcess = null;
  }
  if (mongod) {
    mongod.stop({ doCleanup: false }).catch(() => {});
    mongod = null;
  }
});

process.on('exit', () => {
  if (backendProcess) try { backendProcess.kill(); } catch (_) {}
});

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------
ipcMain.handle('print-bill', async (_event, html) => {
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true },
  });
  await printWin.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
  );
  printWin.webContents.print(
    { silent: false, printBackground: true, margins: { marginType: 'none' } },
    () => printWin.close()
  );
});

ipcMain.handle('get-server-url', () => SERVER_URL);

// Fallback IPC handlers for update functions (overridden by updater.js in packaged builds)
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('check-for-updates', () => ({ success: false, error: 'Updates only available in packaged builds' }));
ipcMain.handle('download-update', () => ({ success: false, error: 'Updates only available in packaged builds' }));
ipcMain.handle('install-update', () => {});

ipcMain.handle('get-startup-state', () => ({
  phase: startupState.phase,
  detail: startupState.detail,
  error: startupState.error,
  mongoUri: !!startupState.mongoUri,
  backendRunning: !!backendProcess,
  serverUrl: SERVER_URL,
  logPath: logFilePath,
}));

ipcMain.handle('restart-backend', async () => {
  logToFile('[IPC] Manual restart-backend requested');
  if (!startupState.mongoUri) {
    // Try starting MongoDB first
    sendStartupStatus('starting-db', 'Starting database...');
    try {
      const uri = await startMongoDB();
      startupState.mongoUri = uri;
      logToFile(`[Restart] MongoDB URI: ${uri}`);
    } catch (err) {
      sendStartupStatus('error', 'Database failed to start', err.message);
      return false;
    }
  }

  // Kill existing backend if stuck
  if (backendProcess) {
    try { backendProcess.kill(); } catch (_) {}
    backendProcess = null;
  }

  backendRestartCount = 0;
  sendStartupStatus('starting-server', 'Starting server...');
  await startBackend(startupState.mongoUri);
  const ready = await waitForServer(12, 2000);
  if (ready) {
    sendStartupStatus('ready', 'Server is running');
  } else {
    sendStartupStatus('error', 'Server failed to start after restart', 'Health check failed');
  }
  return ready;
});
