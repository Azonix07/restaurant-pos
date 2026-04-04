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
let mongod = null; // MongoMemoryServer instance

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

// ---------------------------------------------------------------------------
// Splash / loading window
// ---------------------------------------------------------------------------
function showSplash() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 360,
    frame: false,
    resizable: false,
    transparent: false,
    alwaysOnTop: true,
    backgroundColor: '#4f46e5',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  const splashFile = app.isPackaged
    ? path.join(process.resourcesPath, 'splash.html')
    : path.join(__dirname, 'splash.html');

  splashWindow.loadFile(splashFile);
  splashWindow.center();
}

// ---------------------------------------------------------------------------
// Embedded MongoDB (persistent data — NOT in-memory)
// ---------------------------------------------------------------------------
async function startMongoDB() {
  ensureDir(mongoDataPath);
  ensureDir(mongoBinPath);

  // Configure download location BEFORE requiring the module so its internal
  // resolvers pick up the env vars immediately.
  process.env.MONGOMS_DOWNLOAD_DIR = mongoBinPath;
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

  const uri = mongod.getUri();
  console.log('[MongoDB] Embedded server started:', uri);
  return uri;
}

// ---------------------------------------------------------------------------
// Database seed (idempotent — only inserts if data is missing)
// ---------------------------------------------------------------------------
function runSeed(mongoUri) {
  return new Promise((resolve) => {
    const seedPath = resolvePath('backend', 'src', 'seed.js');
    const cwd = resolvePath('backend');

    const child = spawn(process.execPath, [seedPath], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        MONGODB_URI: mongoUri,
      },
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (d) => console.log('[Seed]', d.toString().trim()));
    child.stderr.on('data', (d) => console.error('[Seed]', d.toString().trim()));
    child.on('close', () => resolve());
    child.on('error', () => resolve()); // don't block startup on seed failure
  });
}

// ---------------------------------------------------------------------------
// Backend Express server (child process using Electron's own Node runtime)
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

    backendProcess.stdout.on('data', (data) => {
      const text = data.toString();
      console.log('[Backend]', text.trim());
      if (text.includes('Server Running')) resolve();
    });

    backendProcess.stderr.on('data', (d) =>
      console.error('[Backend]', d.toString().trim())
    );

    backendProcess.on('error', (err) => {
      console.error('[Backend] Spawn error:', err.message);
      resolve(); // don't block — server may already be running externally
    });

    backendProcess.on('exit', (code) => {
      console.log('[Backend] Exited with code', code);
      backendProcess = null;
    });

    // Fallback timeout so the app isn't stuck forever
    setTimeout(resolve, 20000);
  });
}

// ---------------------------------------------------------------------------
// Wait until the Express health endpoint responds
// ---------------------------------------------------------------------------
function waitForServer(maxAttempts = 40) {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get(`${SERVER_URL}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve(true);
        retry();
      });
      req.on('error', retry);
      req.setTimeout(2000, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (attempts < maxAttempts) setTimeout(check, 800);
      else resolve(false);
    };
    check();
  });
}

// ---------------------------------------------------------------------------
// Main application window
// ---------------------------------------------------------------------------
function createMainWindow() {
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

  // Always load from the backend server — it serves the React frontend
  mainWindow.loadURL(SERVER_URL);

  // Inject server URL for the React app
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(
      `window.SERVER_URL = "${SERVER_URL}";`
    );
  });

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  showSplash();

  try {
    // 1. Start embedded MongoDB with persistent storage
    console.log('[Startup] Starting embedded MongoDB...');
    const mongoUri = await startMongoDB();

    // 2. Seed database on first launch (idempotent)
    const isFirstRun = !fs.existsSync(firstRunFlag);
    if (isFirstRun) {
      console.log('[Startup] First run — seeding database...');
      await runSeed(mongoUri);
      fs.writeFileSync(firstRunFlag, new Date().toISOString());
    }

    // 3. Start the Express backend
    console.log('[Startup] Starting backend server...');
    await startBackend(mongoUri);

    // 4. Wait for the server to be healthy
    console.log('[Startup] Waiting for server health check...');
    const ok = await waitForServer();
    if (!ok) console.warn('[Startup] Server health check timed out — opening anyway');

    console.log('[Startup] Ready!');
  } catch (err) {
    console.error('[Startup] Error during initialization:', err);
  }

  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on('before-quit', () => {
  // Kill the backend child process
  if (backendProcess) {
    try { backendProcess.kill(); } catch (_) {}
    backendProcess = null;
  }
  // Stop embedded MongoDB (fire-and-forget; OS cleans up on exit)
  if (mongod) {
    mongod.stop().catch(() => {});
    mongod = null;
  }
});

// Make sure child processes are cleaned up on unexpected exits
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
