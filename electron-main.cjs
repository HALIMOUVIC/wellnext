// Electron Main Process Entry Point
process.env.NODE_ENV = 'production';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const net = require('net');
const http = require('http');
const fs = require('fs');

let mainWindow;
let selectedPort = 3000;

// Helper to find a free port dynamically
function getFreePort(startingPort = 3000) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startingPort, '0.0.0.0', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(getFreePort(startingPort + 1));
      } else {
        resolve(getFreePort(startingPort + 1));
      }
    });
  });
}

// Poll until the Express server responds on the given port
function waitForServer(port, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function tryConnect() {
      attempts++;
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        resolve();
      });
      req.on('error', () => {
        if (attempts >= maxAttempts) {
          reject(new Error(`Server did not start on port ${port} after ${maxAttempts} attempts`));
        } else {
          setTimeout(tryConnect, 500);
        }
      });
      req.setTimeout(400, () => {
        req.destroy();
        if (attempts >= maxAttempts) {
          reject(new Error(`Server timed out on port ${port}`));
        } else {
          setTimeout(tryConnect, 500);
        }
      });
    }

    setTimeout(tryConnect, 800);
  });
}

function createWindow() {
  try {
    mainWindow = new BrowserWindow({
      width: 1300,
      height: 850,
      title: "Wellbore Schematic Pro",
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Remove default menu bar
    mainWindow.setMenuBarVisibility(false);

    // Show window only once it's ready to avoid blank flicker
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    // Load the web app served by Express on IPv4 loopback
    mainWindow.loadURL(`http://127.0.0.1:${selectedPort}`);

    // Retry if load failed
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.log(`Failed to load (${errorDescription}), retrying in 1s...`);
      setTimeout(() => {
        if (mainWindow) {
          mainWindow.loadURL(`http://127.0.0.1:${selectedPort}`);
        }
      }, 1000);
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  } catch (err) {
    fs.writeFileSync(path.join(app.getPath('userData'), 'window-error.log'), err.stack || err.message);
  }
}

// Start Electron window when ready
app.whenReady().then(async () => {
  try {
    // Find a free port starting from 3000
    selectedPort = await getFreePort(3000);
    process.env.PORT = String(selectedPort);
    process.env.USER_DATA_PATH = app.getPath('userData');

    console.log(`Starting Express server on port ${selectedPort}...`);

    // Start the Express server
    require('./dist/server.cjs');

    // Wait for server to be ready before opening the window
    console.log('Waiting for server to be ready...');
    await waitForServer(selectedPort);
    console.log('Server is ready. Opening window...');

    createWindow();
  } catch (err) {
    const logPath = path.join(app.getPath('userData'), 'startup-error.log');
    fs.writeFileSync(logPath, err.stack || err.message);
    console.error('Startup error:', err);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
