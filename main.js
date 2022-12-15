const electron = require('electron');
const vibe = require('@pyke/vibe');
vibe.setup(electron.app);
const path = require('path');
const os = require('os')
const remote = require("@electron/remote/main")
let win;

electron.app.on('ready', () => {
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
		show: false
	});
	require('@electron/remote/main').initialize()
	require('@electron/remote/main').enable(win.webContents)
	win.loadFile('index.html')
	//win.setHasShadow(true)
	win.removeMenu();
	vibe.applyEffect(win, 'acrylic', '#FFFFFF40');


if (electron.nativeTheme.shouldUseDarkColors) vibe.setDarkMode(win);

	//win.setAlwaysOnTop("alwaysOnTop")
	win.webContents.openDevTools({ mode: "detach" })
	remote.enable(win.webContents)
	win.webContents.on('did-finish-load', () => {
		win.show();
	});
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