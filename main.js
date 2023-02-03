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

function isWin10() {
	return (process.getSystemVersion().startsWith('10.0') && new Number(process.getSystemVersion().split('.')[2]) <= 19045) || (process.getSystemVersion().startsWith('11.0') && new Number(process.getSystemVersion().split('.')[2]) <= 19045)
}
const { session } = require('electron')

if (process.platform === 'win32') {
	electron.app.setAppUserModelId('平板+')
}

function getuserdatapath() {
	return require('path').join(process.env.appdata, 'cmp').replaceAll('\\', '/')
}

if (!fs.existsSync(getuserdatapath())) fs.mkdirSync(getuserdatapath())


const isFirstInstance = electron.app.requestSingleInstanceLock()

electron.app.whenReady().then(() => {
	setTimeout(
		spawnWindow,
		process.platform == "linux" ? 1000 : 0
	);
})

function spawnWindow() {
	if (!isFirstInstance) {
		electron.app.exit()
	}
	win = new electron.BrowserWindow({
		backgroundColor: '#00000000',
		// resizable: false,
		minWidth: 800,
		minHeight: 600,
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
	makeTray()
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
	win.webContents.session.setCertificateVerifyProc((request, callback) => {
		callback(0)
	})
	electron.app.on('second-instance', (event, commandLine, workingDirectory, additionalData) => {
		//输入从第二个实例中接收到的数据
		console.log(additionalData)
		//有人试图运行第二个实例，我们应该关注我们的窗口
		if (win) {
			if (win.isMinimized()) win.restore()
			win.show()
			win.focus()
		}
	})
	if (!isWin10()) {
		vibe.applyEffect(win, 'acrylic', '#FFFFFF40');
	}
	if (electron.nativeTheme.shouldUseDarkColors) vibe.setDarkMode(win);

	//win.setAlwaysOnTop("alwaysOnTop")
	// win.webContents.openDevTools({ mode: "detach" })
	remote.enable(win.webContents)
	win.webContents.on('did-finish-load', () => {
		if (!process.argv.includes('--boot')) {
			win.show()
		}
	});
	win.on('close', (e) => {
		try {
			if (!JSON.parse(fs.readFileSync(getuserdatapath() + '/config')).tray) {
				return;
			}
		} catch { return }
		e.preventDefault(); // 阻止退出程序
		// win.setSkipTaskbar(true) // 取消任务栏显示
		win.hide(); // 隐藏主程序窗口
	})
	// win.on('show', (e) => {
	// 	delTray()
	// })

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

electron.ipcMain.on('exit', (event, ...args) => {
	electron.app.exit()
})

electron.ipcMain.on('dragfile', (event, ...args) => {
	console.log('dragging')
	win.webContents.startDrag(args[0])
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
	if (fs.existsSync(getuserdatapath() + '/account')) {
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
				label: '课堂实录',
				click: function() {
					win.webContents.send('goto', 'classrecord')
					win.show()
				}
			}
			/*, {
						label: '我的设备',
						click: function() {
							win.webContents.send('goto', 'mypad')
							win.show()
						}
					}*/
			, {
				label: '我的资源库',
				click: function() {
					win.webContents.send('goto', 'library')
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
			}
		])
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

const { ipcMain } = require('electron')