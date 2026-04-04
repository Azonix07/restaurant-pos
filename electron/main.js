const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
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

let mainWindow = null;
let splashWindow = null;
let backendProcess = null;
let mongod = null;

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
  return app.isPackaged
    ? path.join(process.resourcesPath, file)
    : path.join(__dirname, file);
}

/** Send a status update to the splash window (if open). */
function splashStatus(text, pct) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents
      .executeJavaScript(`updateStatus("${text}", ${pct})`)
      .catch(() => {});
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
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', MONGODB_URI: mongoUri },
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

    backendProcess = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: String(SERVER_PORT),
        MONGODB_URI: mongoUri,
        NODE_ENV: 'production',
      },
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let resolved = false;
    backendProcess.stdout.on('data', (data) => {
      const text = data.toString();
      console.log('[Backend]', text.trim());
      if (!resolved && text.includes('Server Running')) {
        resolved = true;
        resolve();
      }
    });

    backendProcess.stderr.on('data', (d) =>
      console.error('[Backend]', d.toString().trim())
    );

    backendProcess.on('error', (err) => {
      console.error('[Backend] Spawn error:', err.message);
      if (!resolved) { resolved = true; resolve(); }
    });

    backendProcess.on('exit', (code) => {
      console.log('[Backend] Exited with code', code);
      backendProcess = null;
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
    // 1. Start embedded MongoDB
    splashStatus('Starting database', 10);
    console.log('[Startup] Starting embedded MongoDB...');
    mongoUri = await startMongoDB();
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

    // 4. One quick health check
    serverReady = await healthCheck();
    splashStatus(serverReady ? 'Ready' : 'Finishing up', 95);
  } catch (err) {
    console.error('[Startup] Error:', err);
  }

  // 5. Open the main window immediately — it will either load the app
  //    or show loading.html which polls until the server is up
  createMainWindow(serverReady);
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
