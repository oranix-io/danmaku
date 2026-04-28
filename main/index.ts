import { updateElectronApp } from 'update-electron-app';

updateElectronApp();

import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  MenuItemConstructorOptions,
  Tray,
  screen,
} from 'electron';
import path from 'path';

import {
  AgentEventListener,
  DanmakuClient,
} from '@lib/bililive/main/live/danmaku';
import { danmakuNotificationChannel } from 'common/ipc';
import { Disposable } from 'common/disposable';
import { EMessageEventType } from '@lib/bililive/common/types/danmaku';
import { IGetInfoResponse } from '@lib/bililive/main/live/api';

function isObject(obj: any) {
  return typeof obj === 'object' && obj !== null;
}

interface IDanmakuWindowInfo {
  roomId: string;
  roomInfo: IGetInfoResponse['data'] | undefined;
  eventEmitter: AgentEventListener;
}

const danmakuWindowIds = new Map<number, IDanmakuWindowInfo>();

interface IWindowState {
  shouldKeepFocus: boolean;
  paused: boolean;
}

const defaultWindowState: IWindowState = {
  shouldKeepFocus: false,
  paused: false,
};

const windowStateMap = new Map<number, IWindowState>();

ipcMain.handle('get-owner-browser-window-id', (event) => {
  return BrowserWindow.fromWebContents(event.sender).id;
});

ipcMain.handle('open-danmaku', (event, roomId) => {
  createDanmakuWindow(roomId);
});

ipcMain.handle('retrieve-danmaku', async (event, { roomId }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const danmakuWindowInfo = danmakuWindowIds.get(win.id);

  if (!danmakuWindowInfo) return;
  const { eventEmitter } = danmakuWindowInfo;
  const client = DanmakuClient.instance(roomId);
  if (!client) return;
  if (!client.started) return;
  client.replayEvent(eventEmitter);
});

let currentTransparency = 60;

ipcMain.handle('danmaku-menu', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const menu = Menu.buildFromTemplate(buildDanmakuWindowContextMenu(win));
  menu.popup({
    window: BrowserWindow.fromWebContents(event.sender),
  });
});

const createMainWindow = () => {
  const desktopSize = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: Math.floor(desktopSize.width * 0.8),
    height: Math.floor(desktopSize.height * 0.8),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      webviewTag: true,
    },
  });

  if (process.env.NODE_ENV === 'production') {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  } else {
    win.loadURL('http://localhost:5173');
  }
  return win;
};

function ignoreWinMouseEvent(id: number, ignore: boolean) {
  const win = BrowserWindow.fromId(id);
  if (!win) {
    return;
  }
  win.setResizable(!ignore);
  win.setIgnoreMouseEvents(ignore);
}

const createDanmakuWindow = (roomId: string) => {
  let win = new BrowserWindow({
    width: 800,
    height: 600,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    closable: true,
    frame: false,
    hasShadow: true,
    maximizable: false,
    fullscreenable: false,
    resizable: true,
    opacity: currentTransparency / 100,
    // transparent: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/danmaku/index.js'),
      additionalArguments: ['--roomId=' + roomId],
    },
  });
  function setIgnoreMouseEvents(ignore: boolean) {
    const windowState = windowStateMap.get(win.id) ?? defaultWindowState;
    if (windowState.shouldKeepFocus) {
      return;
    }
    ignoreWinMouseEvent(win.id, ignore);
  }
  win.on('blur', () => {
    setIgnoreMouseEvents(true);
  });
  win.on('focus', () => {
    setIgnoreMouseEvents(false);
  });
  win.on('resize', () => {
    setIgnoreMouseEvents(false);
  });
  win.on('will-resize', () => {
    setIgnoreMouseEvents(false);
  });

  if (process.env.NODE_ENV === 'production') {
    win.loadFile(path.join(__dirname, '../renderer/danmaku.html'));
  } else {
    win.loadURL('http://localhost:5173/danmaku.html');
  }

  const disposable = new Disposable();

  disposable.add({
    dispose: () => {
      danmakuWindowIds.delete(win.id);
    },
  });
  win.on('close', () => {
    console.log('cleanup');
    // 移除所有的事件监听
    disposable.dispose();
  });
  win.on('closed', () => {
    win = null;
  });

  win.webContents.once('did-stop-loading', async () => {
    const danmakuClient = DanmakuClient.instance(roomId);

    const channelId = danmakuNotificationChannel;

    const eventEmitter = new AgentEventListener();
    eventEmitter.registerBeforeEmit(() => {
      return windowStateMap.get(win.id)?.paused;
    });

    disposable.add(eventEmitter);
    disposable.add(danmakuClient.addEventEmitter(eventEmitter));
    disposable.add(
      eventEmitter.onCommand((command) => {
        if (!win) {
          disposable.dispose();
          return;
        }
        win.webContents.send(channelId, {
          type: EMessageEventType.COMMAND,
          command: {
            name: command.name,
            data: isObject(command.data) ? command.data : command.data.toJSON(),
          },
        });
      })
    );

    eventEmitter.onPopularity((popularity) => {
      if (!win) {
        disposable.dispose();
        return;
      }

      win.webContents.send(channelId, {
        type: EMessageEventType.POPULARITY,
        popularity: popularity.toJSON(),
      });
    });

    await danmakuClient.start();
    const roomInfo = await danmakuClient.getRoomInfo();
    danmakuWindowIds.set(win.id, {
      roomId,
      roomInfo,
      eventEmitter,
    });
    win.focus();
  });
  win.webContents.openDevTools();
};

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function buildDanmakuWindowContextMenu(win: BrowserWindow) {
  if (!win) return [];
  const transparencyStep = 10;
  const transparencyMax = 100;
  const transparencyMin = 20;

  const opacity = win.getOpacity();
  currentTransparency = Math.floor(opacity * 100);

  const transparencyMenu = [] as Electron.MenuItemConstructorOptions[];

  for (let i = transparencyMin; i <= transparencyMax; i += transparencyStep) {
    transparencyMenu.push({
      label: `${i}%`,
      type: 'radio',
      checked: i === currentTransparency,
      click: () => {
        if (win) win.setOpacity(i / 100);
      },
    });
  }

  const template = [
    {
      label: 'Transparency',
      type: 'submenu',
      submenu: transparencyMenu,
    },
    { type: 'separator' },
    {
      label: 'Always on top',
      type: 'checkbox',
      checked: win ? win.isAlwaysOnTop() : false,
      click: () => {
        if (win) win.setAlwaysOnTop(!win.isAlwaysOnTop());
      },
    },
    {
      label: 'Pause',
      type: 'checkbox',
      checked: (windowStateMap.get(win.id) ?? defaultWindowState).paused,
      click: () => {
        const oldState = windowStateMap.get(win.id);

        windowStateMap.set(win.id, {
          ...oldState,
          paused: !oldState?.paused,
        });
      },
    },
    {
      label: 'Reload',
      click: () => {
        if (win) win.reload();
      },
    },
    {
      label: 'Toggle DevTools',
      click: () => {
        if (win) {
          win.webContents.toggleDevTools();
        }
      },
    },
    {
      label: 'Close',
      click: () => {
        if (win) win.close();
      },
    },
  ] as MenuItemConstructorOptions[];
  return template;
}

function buildTray() {
  const danmakuWindow = Array.from(
    danmakuWindowIds.entries(),
    ([id, { roomId, roomInfo }]) => ({
      label: `${id}: ${
        roomInfo ? `${roomInfo.title} - ${roomInfo.area_name}` : 'Room'
      }(${roomId})`,
      type: 'submenu',
      submenu: [
        {
          label: 'Focus',
          click: () => {
            const win = BrowserWindow.fromId(id);
            if (win) {
              win.show();
              win.focus();
            }
          },
        },
        {
          label: 'Keep focus',
          type: 'checkbox',
          checked: (windowStateMap.get(id) ?? defaultWindowState)
            .shouldKeepFocus,
          click: () => {
            const oldState = windowStateMap.get(id) ?? defaultWindowState;
            const shouldKeepFocus = !oldState.shouldKeepFocus;
            const win = BrowserWindow.fromId(id);
            if (win) {
              if (shouldKeepFocus) {
                win.focus();
              } else {
                win.blur();
              }
              ignoreWinMouseEvent(win.id, !shouldKeepFocus);
            }

            // 放在最后更新状态
            windowStateMap.set(id, {
              ...oldState,
              shouldKeepFocus,
            });
          },
        },
        { type: 'separator' },
        ...buildDanmakuWindowContextMenu(BrowserWindow.fromId(id)),
      ],
    })
  ) as Electron.MenuItemConstructorOptions[];
  if (danmakuWindow.length > 0) {
    danmakuWindow.push({ type: 'separator' });
  }

  const runningDanmakuClients = DanmakuClient.getRunningInstances().map((v) => {
    return {
      label: `${v.roomId}`,
      type: 'submenu',
      submenu: [
        {
          label: 'Stop',
          click: () => {
            v.stop();
          },
        },
      ],
    };
  }) as Electron.MenuItemConstructorOptions[];

  if (runningDanmakuClients.length > 0) {
    runningDanmakuClients.push({ type: 'separator' });
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Main Window',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          mainWindow = createMainWindow();
        }
      },
    },
    { type: 'separator' },
    ...danmakuWindow,
    ...runningDanmakuClients,
    {
      label: 'Quit',
      role: 'quit',
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setToolTip('Bililive');
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  mainWindow = createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.on('close', () => {
    mainWindow = null;
  });

  tray = new Tray('./assets/icons/png/24x24.png');
  buildTray();
  tray.on('click', () => {
    buildTray();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
