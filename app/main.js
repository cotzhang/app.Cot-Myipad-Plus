const { toggleDebugging: debug } = require('../dist/debug')
const { BrowserWindow } = require('../dist')
const electron = require('electron');
const os = require('os')
const remote = require("@electron/remote/main")
let win;
electron.app.on('ready', () => {
	setTimeout(
		spawnWindow,
		process.platform == "linux" ? 1000 : 0
		// Electron has a bug on linux where it
		// won't initialize properly when using
		// transparency. To work around that, it
		// is necessary to delay the window
		// spawn function.
	);
});

function isVibrancySupported() {
	// Windows 10 or greater
	return (
		process.platform === 'win32' &&
		parseInt(os.release().split('.')[0]) >= 10
	)
}

let vibrancy = 'dark'
	//debug(true)
if (isVibrancySupported()) {
	vibrancy = {
		theme: '#eeeeee88',
		effect: 'acrylic',
		useCustomWindowRefreshMethod: true,
		disableOnBlur: true,
		debug: false,
	}
}
if(electron.nativeTheme.shouldUseDarkColors){
	vibrancy.theme="#22222288";
}else{
	vibrancy.theme="#eeeeee88";
}

function spawnWindow(){
	

	win = new BrowserWindow({
		width: 800,
		height: 600,
		frame: false,
		resizable:false,
		webPreferences:{
	  		nodeIntegration: true, 
			enableRemoteModule: true,
	  		contextIsolation: false,
	  		webviewTag: true
    	},
    	vibrancy:vibrancy
	});
	require('@electron/remote/main').initialize()
	require('@electron/remote/main').enable(win.webContents)
	win.loadFile('index.html')
	//win.setHasShadow(true)
	win.removeMenu() 
	//win.setAlwaysOnTop("alwaysOnTop")
	win.webContents.openDevTools({mode:"detach"})
	remote.enable(win.webContents)
	win.webContents.on('did-finish-load', () => {
		win.show();
	});
	return win;
}

electron.nativeTheme.on('updated', () => {
  	const wins = BrowserWindow.getAllWindows();
  	if(electron.nativeTheme.shouldUseDarkColors){
  		vibrancy.theme="#22222288";
  	}else{
  		vibrancy.theme="#eeeeee88";
  	}
  	win.setVibrancy(vibrancy)
});