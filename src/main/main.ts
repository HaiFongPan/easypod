import './setupLogging';
import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron';
import { join } from 'path';
import { platform } from 'os';
import { FeedIPCHandlers } from './services/IPCHandlers';
import { getDatabaseManager } from './database/connection';
import { FunASRIPCHandlers } from './services/funasr/FunASRIPCHandlers';
import { getPythonRuntimeManager } from './services/funasr/PythonRuntimeManager';
import { PythonRuntimeIPCHandlers } from './services/funasr/PythonRuntimeIPCHandlers';
import { TranscriptConfigIPCHandlers } from './services/transcript/TranscriptConfigIPCHandlers';
import { TranscriptIPCHandlers } from './services/transcript/TranscriptIPCHandlers';

const isDevelopment = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const debugPythonRuntime = process.env.DEBUG_PYTHON_RUNTIME === '1' || isDevelopment;

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let feedIPCHandlers: FeedIPCHandlers | null = null;
let funasrIPCHandlers: FunASRIPCHandlers | null = null;
let pythonRuntimeIPCHandlers: PythonRuntimeIPCHandlers | null = null;
let transcriptConfigIPCHandlers: TranscriptConfigIPCHandlers | null = null;
let transcriptIPCHandlers: TranscriptIPCHandlers | null = null;

const createWindow = (): void => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
      webSecurity: !isDevelopment,
    },
  });

  // Load the app
  if (isDevelopment) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
};

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Initialize database
  try {
    console.log('[Database] Initializing database...');
    const dbManager = getDatabaseManager();
    await dbManager.initialize();
    console.log('[Database] Database initialized successfully');
  } catch (error) {
    console.error('[Database] Failed to initialize database:', error);
    // Continue even if database initialization fails
  }

  createWindow();

  // Initialize RSS feed IPC handlers
  feedIPCHandlers = new FeedIPCHandlers();

  // Set up Python Runtime logging and auto-start FunASR service
  const runtimeManager = getPythonRuntimeManager();
  if (debugPythonRuntime) {
    runtimeManager.on('log', (message: string) => {
      console.log('[PythonRuntime]', message);
    });
    runtimeManager.on('error', (error: Error) => {
      console.error('[PythonRuntime] Error:', error);
    });
    runtimeManager.on('ready', (details: any) => {
      console.log('[PythonRuntime] Ready:', details);
    });
  }

  // Auto-start FunASR service if Python Runtime is already provisioned
  if (runtimeManager.isProvisioned()) {
    console.log('[App] Python Runtime is provisioned, starting FunASR service...');
    // Import getFunASRManager here to avoid circular dependency
    const { getFunASRManager } = await import('./services/funasr/FunASRManager');
    const funasrManager = getFunASRManager();

    // Start service in background, don't block app startup
    funasrManager.ensureReady()
      .then(() => {
        console.log('[App] FunASR service started successfully');
      })
      .catch((error) => {
        console.warn('[App] FunASR service failed to start:', error);
        // Don't fail app startup, service can be started later
      });
  } else {
    console.log('[App] Python Runtime not provisioned yet, skipping FunASR service startup');
  }

  // Initialize FunASR IPC handlers
  funasrIPCHandlers = new FunASRIPCHandlers();

  // Initialize Python Runtime IPC handlers
  pythonRuntimeIPCHandlers = new PythonRuntimeIPCHandlers(mainWindow);
  console.log('[PythonRuntime] Python Runtime IPC handlers initialized');

  // Initialize Transcript Config IPC handlers
  transcriptConfigIPCHandlers = new TranscriptConfigIPCHandlers(mainWindow);

  // Initialize Transcript IPC handlers
  transcriptIPCHandlers = new TranscriptIPCHandlers();
  console.log('[Transcript] Transcript IPC handlers initialized');

  // macOS specific: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Set up menu
  if (platform() === 'darwin') {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'EasyPod',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'File',
        submenu: [
          {
            label: 'Add Subscription',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              mainWindow?.webContents.send('menu-add-subscription');
            }
          },
          { type: 'separator' },
          { role: 'close' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (platform() !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Cleanup IPC handlers
  if (feedIPCHandlers) {
    feedIPCHandlers.destroy();
    feedIPCHandlers = null;
  }
  if (funasrIPCHandlers) {
    funasrIPCHandlers.destroy();
    funasrIPCHandlers = null;
  }
  if (pythonRuntimeIPCHandlers) {
    pythonRuntimeIPCHandlers.destroy();
    pythonRuntimeIPCHandlers = null;
  }
  if (transcriptConfigIPCHandlers) {
    transcriptConfigIPCHandlers.destroy();
    transcriptConfigIPCHandlers = null;
  }
  if (transcriptIPCHandlers) {
    transcriptIPCHandlers.destroy();
    transcriptIPCHandlers = null;
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-platform', () => {
  return platform();
});

// Prevent navigation to external websites
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    if (parsedUrl.origin !== 'http://localhost:5173' && isDevelopment) {
      return;
    }

    if (!isDevelopment) {
      event.preventDefault();
    }
  });
});
