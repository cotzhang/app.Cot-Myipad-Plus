const electron = require('electron');
const vibe = require('@pyke/vibe');
vibe.setup(electron.app);
const path = require('path');
const os = require('os')
const fs = require('fs')
const remote = require("@electron/remote/main")
const ex = process.execPath;
// const isDev = require('electron-is-dev')

let win;

if (process.platform === 'win32') {
	electron.app.setAppUserModelId('平板+')
}


const isFirstInstance = electron.app.requestSingleInstanceLock()

if (!isFirstInstance) {
	alert('应用已经启动，请检查系统托盘')
	electron.app.quit()
}

electron.app.on('ready', () => {
	electron.app.commandLine.appendSwitch('ignore-certificate-errors')
	electron.app.commandLine.appendSwitch('ignore-ssl-errors')
	setTimeout(
		spawnWindow,
		process.platform == "linux" ? 1000 : 0
	);
});

function spawnWindow() {
	win = new electron.BrowserWindow({
		width: 800,
		height: 600,
		backgroundColor: '#00000000',
		resizable: false,
		webPreferences: {
			nodeIntegration: true,
			enableRemoteModule: true,
			contextIsolation: false,
			webviewTag: true,
			nodeIntegrationInWorker: true
		},
		icon: __dirname + '/icon.png',
		show: false
	});
	require('@electron/remote/main').initialize()
	require('@electron/remote/main').enable(win.webContents)
	win.loadFile('index.html')
	//win.setHasShadow(true)
	// const { Menu, BrowserWindow } = require('electron'); //引入
	// let template = [
	// 	{
	// 		label:"◀",
	// 		click:()=>{
	// 			win.webContents.send('rywebback')
	// 		}
	// 	},
	// 	{
	// 		label: '提取文件',
	// 		click:()=>{
	// 			win.webContents.send('ryfilelink')
	// 		}
	// 	},
	// ]
	// let m = Menu.buildFromTemplate(template);
	// Menu.setApplicationMenu(m);
	win.removeMenu();
	vibe.applyEffect(win, 'acrylic', '#FFFFFF40');
	if (electron.nativeTheme.shouldUseDarkColors) vibe.setDarkMode(win);

	//win.setAlwaysOnTop("alwaysOnTop")
	win.webContents.openDevTools({ mode: "detach" })
	remote.enable(win.webContents)
	win.webContents.on('did-finish-load', () => {
		if (!process.argv.includes('--boot')) {
			win.show()
		} else {
			makeTray()
		}
	});
	win.on('close', (e) => {
		if (!JSON.parse(fs.readFileSync(__dirname + '/config')).tray) {
			return;
		}
		e.preventDefault(); // 阻止退出程序
		// win.setSkipTaskbar(true) // 取消任务栏显示
		win.hide(); // 隐藏主程序窗口
		makeTray()
	})
	win.on('show', (e) => {
		delTray()
	})

	return win;
}

electron.nativeTheme.on('updated', () => {
	const wins = electron.BrowserWindow.getAllWindows();
	if (electron.nativeTheme.shouldUseDarkColors) {
		vibe.setDarkMode(win);

	} else {
		vibe.setLightMode(win);
	}
});

electron.ipcMain.on('testmode', (event, ...args) => {
	win.webContents.openDevTools({ mode: "detach" })
})

electron.ipcMain.on('openwin', (event, ...args) => {
	win.show()
	console.log('Notification Clicked')
})

// Boot Load On!
electron.ipcMain.on('openAutoStart', () => {
	console.log('Boot Load On!', ex)
	electron.app.setLoginItemSettings({
		openAtLogin: true,
		path: ex,
		args: ['--boot']
	});
});

// Boot Load Off!
electron.ipcMain.on('closeAutoStart', () => {
	console.log('Boot Load Off!', ex)
	electron.app.setLoginItemSettings({
		openAtLogin: false,
		path: ex,
		args: ['--boot']
	});
})

// Tray
let tray = null

function makeTray() {
	tray = new electron.Tray(path.join(__dirname, 'snpicon.png'))
	let contextMenu;
	if (fs.existsSync(__dirname + '/account')) {
		contextMenu = electron.Menu.buildFromTemplate([{
			label: '自主学习',
			click: function() {
				win.webContents.send('goto', 'selflearn')
				win.show()
			}
		}, {
			label: '睿易云',
			click: function() {
				win.webContents.send('gotoryy')
			}
		}, {
			label: '学情分析',
			click: function() {
				win.webContents.send('gotoryy-xq')
			}
		}, {
			label: '我的设备',
			click: function() {
				win.webContents.send('goto', 'mypad')
				win.show()
			}
		}, {
			type: 'separator'
		}, {
			label: '账号与设置',
			click: function() {
				win.webContents.send('goto', 'account')
				win.show()
			}
		}, {
			type: 'separator'
		}, {
			label: '立即同步',
			click: function() {
				win.webContents.send('sync')
			}
		}, {
			type: 'separator'
		}, {
			label: '显示主窗口',
			click: function() {
				win.show()
			}
		}, {
			label: '退出',
			click: function() {
				console.log("Exit!");
				delTray()
				win.destroy();
				electron.app.quit();
			}
		}])
	} else {
		contextMenu = electron.Menu.buildFromTemplate([{
			label: '您尚未登录',
			enabled: false
		}, {
			type: 'separator'
		}, {
			label: '显示主窗口',
			click: function() {
				win.show()
			}
		}, {
			label: '退出',
			click: function() {
				console.log("Exit!");
				delTray()
				win.destroy();
				electron.app.quit();
			}
		}])
	}
	tray.setToolTip('平板+')
	tray.setContextMenu(contextMenu)
	tray.on("click", () => {
		win.show();
	})
}

function delTray() {
	try {
		tray.destroy()
	} catch { console.log("no tray to destroy") }
}