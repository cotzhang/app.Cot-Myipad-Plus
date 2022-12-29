// Import Libraries
let panelistic;
const path = require('path');
const electron = require('electron')
const remote = require("@electron/remote");

// Fs Promisfy
fs.readFilePromise = function(path) {
	return new Promise(function(resolve, reject) {
		fs.readFile(path, { flag: 'r', encoding: 'utf-8' }, function(err, data) {
			if (err) {
				reject(err)
			} else {
				resolve(data)
			}
		})
	})
}
fs.writeFilePromise = function(path, content) {
	return new Promise(function(resolve, reject) {
		fs.writeFile(path, content, { flag: 'a', encoding: 'utf-8' }, function(
			err
		) {
			if (err) {
				reject(err)
			} else {
				resolve()
			}
		})
	})
}
fs.mkdirPromise = function(path) {
	return new Promise(function(resolve, reject) {
		fs.mkdir(path, function(err) {
			if (err) {
				reject(err)
			} else {
				resolve()
			}
		})
	})
}
fs.renamePromise = function(oldPath, newPath) {
	return new Promise(function(resolve, reject) {
		fs.rename(oldPath, newPath, function(err) {
			if (err) {
				reject(err)
			} else {
				resolve()
			}
		})
	})
}
fs.readdirPromise = function(path, options) {
	return new Promise(function(resolve, reject) {
		fs.readdir(path, options, function(err, files) {
			if (err) {
				reject(err)
			} else {
				resolve(files)
			}
		})
	})
}

// Path configure function
function p(pathname) {
	return __dirname + pathname;
}

// String methods
function unEscape(str) {
	var temp = document.createElement("div");
	temp.innerHTML = str;
	str = temp.innerText || temp.textContent;
	temp = null;
	return str;
}

// Relogin
function makeRelogin() {
	fs.writeFileSync(__dirname + '/relogin', "error");
	window.location.reload();
}

// Global Variables
let webview;

let currCountReal = 0;
let totalCounts = 0;
let fullDataSyncRetVal = [];
let disableSync = false;
let baseRecordCount = 0;

// Data procedures
function getClassGUIDs() {
	let classstr = "";
	for (var i = 0; i < globalDataFile.classes.length; i++) {
		classstr += globalDataFile.classes[i].guid + ",";
	}
	classstr += getGlobalUserguid();
	return classstr;
}

function generateTextRecords(fullrec) {
	let finalstr = "enablesegment=3;"
	let itemcnt = 0;
	for (var item in fullrec) {
		finalstr += fullrec[itemcnt].guid + "=" + fullrec[itemcnt].syn_timestamp + ";";
		itemcnt++;
	}
	return finalstr;
}

// Init sync data
function syncData() {
	// Disable sidebar click
	document.getElementById('panelistic_sidebar').style.pointerEvents = "none";
	webview.src = __dirname + "/logload.html";
	globalDataFile = JSON.parse(fs.readFileSync(__dirname + "/data"));
	globalAccountFile = JSON.parse(fs.readFileSync(__dirname + "/account"));

	// Debug log
	console.log("Sync sessionid " + getGlobalSessionId());

	// UI text configure
	document.getElementById("panelistic_sidebar_title").innerText = getGlobalUsrname();
	document.getElementById("panelistic_sidebar_subtitle").innerText = getDisplayName();

	// Read previous records
	let prevRecords = []
	fullDataSyncRetVal = [];
	try {
		prevRecords = JSON.parse(fs.readFileSync(__dirname + '/resources'))
	} catch (err) {
		console.warn(err)
	}
	baseRecordCount = prevRecords.length;

	requestFullClassPrepare(prevRecords, requestFullClassPrepareParse)
}

function requestFullClassPrepare(allrecords, callback) {
	// console.log(allrecords)
	let requestBody = `<v:Envelope xmlns:v="http://schemas.xmlsoap.org/soap/envelope/" xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:d="http://www.w3.org/2001/XMLSchema" xmlns:c="http://schemas.xmlsoap.org/soap/encoding/">
	<v:Header/>
	<v:Body>
		<LessonsScheduleGetTableData xmlns="http://webservice.myi.cn/wmstudyservice/wsdl/" id="o0" c:root="1">
			<lpszTableName i:type="d:string">lessonsschedule</lpszTableName>
			<lpszUserClassGUID i:type="d:string">${getClassGUIDs()}</lpszUserClassGUID>
			<lpszStudentID i:type="d:string">${globalAccountFile.account}</lpszStudentID>
			<lpszLastSyncTime i:type="d:string"></lpszLastSyncTime>
			<szReturnXML i:type="d:string">${generateTextRecords(allrecords)}</szReturnXML>
		</LessonsScheduleGetTableData>
	</v:Body></v:Envelope>`
	autoRetryRequestWSDL("http://webservice.myi.cn/wmstudyservice/wsdl/LessonsScheduleGetTableData", requestBody, (data) => {
		data = data + ""
		var gotdatas = data.substring(data.indexOf('<AS:szReturnXML>') + 16, data.indexOf("</AS:szReturnXML>"));
		gotdatas = unEscape(gotdatas);
		let allrecs = parseDom(gotdatas)[0].childNodes
		for (let i = 0; i < allrecs.length; i++) {
			if (allrecs[0].nodeValue == '\n') {
				console.log('Skipped section 1')
				finishFullClassPrepareParse();
				return;
			}
			allrecords.push(parseRawRecordSync(allrecs[i]));
		}
		if ((data + "").indexOf('hasMoreData="true"') != -1) {
			requestFullClassPrepare(allrecords, callback);
		} else {
			callback(allrecords);
		}
	}, 500, 2000);
}

function parseRawRecordSync(singleRecord) {
	let retv = {};
	let allrecs;
	const elementKeys = [
		'guid',
		'subject',
		'lessonindex',
		'scheduledate',
		'resourceguid',
		'userschoolguid',
		'userclassguid',
		'userclassname',
		'state',
		'syn_timestamp',
		'syn_isdelete',
		'scheduleenddate'
	];
	elementKeys.forEach(key => {
		const element = singleRecord.querySelector(key);
		retv[key] = element ? element.innerText : undefined;
	});
	return retv;
}

function getResourceByGUID(callback, thisProcess) {
	// let thisProcess = currCountReal;
	let reqstrs = `<v:Envelope xmlns:v="http://schemas.xmlsoap.org/soap/envelope/" xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:d="http://www.w3.org/2001/XMLSchema" xmlns:c="http://schemas.xmlsoap.org/soap/encoding/">
	<v:Header/>
	<v:Body>
		<GetResourceByGUID xmlns="http://webservice.myi.cn/wmstudyservice/wsdl/" id="o0" c:root="1">
			<lpszResourceGUID i:type="d:string">${fullDataSyncRetVal[thisProcess].resourceguid}</lpszResourceGUID>
		</GetResourceByGUID>
	</v:Body></v:Envelope>`;
	autoRetryRequestWSDL("http://webservice.myi.cn/wmstudyservice/wsdl/GetResourceByGUID", reqstrs, (allretval) => {
		try {
			// console.log(reqstrs)
			let psretval = allretval.substring(allretval.indexOf('<AS:szXMLContent>') + 17, allretval.indexOf("</AS:szXMLContent>"));
			var temp = document.createElement("div");
			temp.innerHTML = psretval;
			psretval = temp.innerText || temp.textContent;
			temp = null;
			allrecs = parseDom(psretval)[0];
			globalTestVar = allrecs;
			fullDataSyncRetVal[thisProcess].author = allrecs.childNodes[0].attributes.author.value
			fullDataSyncRetVal[thisProcess].date = allrecs.childNodes[0].attributes.date.value
			fullDataSyncRetVal[thisProcess].resguid = allrecs.childNodes[0].attributes.guid.value
			fullDataSyncRetVal[thisProcess].numbersubject = allrecs.childNodes[0].attributes.numbersubject.value
			fullDataSyncRetVal[thisProcess].subject = allrecs.childNodes[0].attributes.subject.value
			fullDataSyncRetVal[thisProcess].title = allrecs.childNodes[0].attributes.title.value
			const logs = allrecs.childNodes[0].childNodes[1].getElementsByTagName("log");
			fullDataSyncRetVal[thisProcess].logs = [];
			for (let i = 0; i < logs.length; i++) {
				const log = logs[i];
				const date = log.getAttribute("date");
				const operatorguid = log.getAttribute("operatorguid");
				const operatorname = log.getAttribute("operatorname");
				const content = log.textContent;
				fullDataSyncRetVal[thisProcess].logs.push({ date, operatorguid, operatorname, content });
			}
			const allress = allrecs.childNodes[0].childNodes[2].getElementsByTagName("resource");
			fullDataSyncRetVal[thisProcess].resource = [];
			for (let i = 0; i < allress.length; i++) {
				const thisres = allress[i];
				const guid = thisres.getAttribute("guid");
				const resourcetype = thisres.getAttribute("resourcetype");
				const title = thisres.getAttribute("title");
				fullDataSyncRetVal[thisProcess].resource.push({ guid, resourcetype, title });
			}
		} catch (err) {
			// console.warn(err, allretval)
			// debugger;
			fullDataSyncRetVal[thisProcess].error = 1;
			fullDataSyncRetVal[thisProcess].scheduledate = "0";
			fullDataSyncRetVal[thisProcess].date = "0";
		}
		if (fullDataSyncRetVal[thisProcess].author == undefined) {
			fullDataSyncRetVal[thisProcess].error = 1;
			fullDataSyncRetVal[thisProcess].scheduledate = "0";
			fullDataSyncRetVal[thisProcess].date = "0";
		}
		webview.send('itemdatai', currCountReal)
		webview.send('totdata', currCountReal + "/" + totalCounts)
		currCountReal++;
		callback(currCountReal)
	}, 500, 500)
}

// ┌────────────┐     ┌───────────────┐
// │540 REQUESTS├────►│Request 50 data│
// └────────────┘     └┬──────────────┘
//                     │Callback
//                     ▼
//                    ┌───────────────┐
//                    │Request 50 data│
//                    └┬──────────────┘
//                     │
//                     ▼
//                     ....
//                     │
//                     ▼
//                    ┌───────────────┐
//                    │Finish all sync│
//                    └───────────────┘


function parse50Records(callback) {
	let startIndex = currCountReal;
	for (var i = 0; i < 50; i++) {
		if (startIndex + i > totalCounts - 1) {
			return;
		}
		getResourceByGUID((cb) => { callback(cb) }, startIndex + i);
	}
}

function requestFullClassPrepareParse(allrecords) {
	console.log("Sync Section 1 Finished\n( fetch classprepare data )");
	currCountReal = 0;
	totalCounts = allrecords.length - baseRecordCount;
	fullDataSyncRetVal = allrecords.slice(baseRecordCount);
	webview.send('itemdatal', totalCounts)
	parse50Records(() => { recallParsing() })
}

function recallParsing() {
	if (currCountReal < totalCounts) {
		if ((currCountReal + 1) % 50 == 0) {
			parse50Records(() => { recallParsing() })
		}
	}
	if (currCountReal == totalCounts) {
		finishFullClassPrepareParse()
	}
}

function finishFullClassPrepareParse() {
	let prevRecords = []
	try {
		prevRecords = JSON.parse(fs.readFileSync(__dirname + '/resources'))
	} catch (err) {
		console.warn(err)
	}
	let receivedArgs = prevRecords.concat(fullDataSyncRetVal);
	console.log("Sync Section 2 Finished\n( fetch classprepare data )");
	let sorted = receivedArgs.sort(sortAllArrs)
	fs.writeFileSync(__dirname + '/resources', JSON.stringify(sorted));
	fetchAllRuiyiYun(finishFetchAllRuiyiYun)
}

function finishAllSyncProgress() {
	document.getElementById('panelistic_sidebar').style.pointerEvents = "unset";
	try {
		panelistic.dialog.dismiss(currdiag);
	} catch {}
	try {
		webview.loadURL(__dirname + "/selflearn.html")
		webview.loadURL(__dirname + "/selflearn.html")
	} catch {}
	setTimeout(() => {
		if (webview.getURL().indexOf('selflearn') == -1) {
			webview.loadURL(__dirname + "/selflearn.html")
		}
	}, 500)
}

// Sync Ruiyiyun Data
function fetchAllRuiyiYun(callback) {
	autoRetryRequest('https://gzzxres.lexuewang.cn:8008/practice/api/TaskExposeAPI/GetTaskList?userId=' + getGlobalUserguid() + '&pageIndex=1&pageSize=1000000', '', [], (response) => {
		let allRyy = []
		let totalPageData = JSON.parse(response).data.pageData;
		for (var i = 0; i < totalPageData.length; i++) {
			allRyy.push(parseRuiyiYunDataSync(totalPageData[i]));
		}
		callback(allRyy);
	}, 20000, 1000, true)
}

function finishFetchAllRuiyiYun(allRyy) {
	let sorted = allRyy.sort(sortAllArrs)
	fs.writeFileSync(__dirname + '/ryyresources', JSON.stringify(sorted));
	console.log("Sync Section 3 Finished\n( fetch ruiyiyun data )");

	getTotalAnswerSheet()
}

function parseRuiyiYunDataSync(ryydata) {
	let retv = ryydata;
	retv.isryyun = true;
	retv.detailsurl = ryydata.detailsURL;
	retv.syn_isdelete = "0"
	retv.subject = ryydata.courseName
	retv.title = ryydata.taskName
	retv.resourceguid = ryydata.stuTaskId
	retv.author = ryydata.teacherId
	retv.scheduledate = ryydata.beginTime
	retv.scheduleenddate = ryydata.endTime
	return retv;
}

//Sync answersheet
let answerSheetData = [];

function getTotalAnswerSheet() {
	answerSheetData = [];
	let allAnswerSheets = [];
	try {
		allAnswerSheets = generateArrayAnswersheet(JSON.parse(fs.readFileSync(__dirname + '/answersheets')))
	} catch {}
	let reqstr = JSON.stringify(allAnswerSheets);
	autoRetryRequest('https://' + getGlobalServerAddr() + '/restfuldatasource/answersheetresult/', reqstr, [{ key: 'Set-Cookie', value: 'sessionid=' + getGlobalSessionId() + ';szUserGUID=' + getGlobalUserguid() + ';szUserName=' + globalAccountFile.account }], (data) => {
		let asToDownload = ((JSON.parse(data).download) ? JSON.parse(data).download : []).concat((JSON.parse(data).modified) ? JSON.parse(data).modified : []);
		// console.log(asToDownload)
		let reqAnssheetOrder = 0;
		if (Math.ceil(asToDownload.length / 200) == 0) {
			storeAnswersheets()
		}
		for (let j = 0; j < Math.ceil(asToDownload.length / 200); j++) {
			generateHeaderOf200Answersheets(asToDownload, 200 * j, (allheaders) => {
				// console.log(allheaders)
				// debugger;
				autoRetryRequest('https://' + getGlobalServerAddr() + '/restfuldatasource/answersheetresult/dummy.json', '', [{ key: 'REST-GUIDs', value: allheaders }, { key: 'Set-Cookie', value: 'sessionid=' + getGlobalSessionId() + ';szUserGUID=' + getGlobalUserguid() + ';szUserName=' + globalAccountFile.account }], (backdata) => {
					// console.log('bd', JSON.parse(backdata))
					answerSheetData = answerSheetData.concat(JSON.parse(backdata));
					reqAnssheetOrder++;
					if (reqAnssheetOrder == Math.ceil(asToDownload.length / 200)) {
						storeAnswersheets()
					}
				}, 1500, 80000, true);
			})
		}
	}, 500, 5000);
}

function generateArrayAnswersheet(prevasw) {
	let retv = [];
	for (let i = 0; i < prevasw.length; i++) {
		retv.push({ guid: prevasw[i].guid, mMode: prevasw[i].mMode, syn_isdelete: prevasw[i].syn_isdelete, syn_timestamp: prevasw[i].syn_timestamp })
	}
	return retv;
}

function generateHeaderOf200Answersheets(todownload, posStart, callBack) {
	let allheaders = ""
	for (let i = posStart; i < posStart + 200; i++) {
		if (i + 1 >= todownload.length) {
			break;
		}
		allheaders += (todownload[i].guid) + ";"
	}
	callBack(allheaders)
}

function getTotalAnswerSheetStudent() {
	answerSheetData = [];
	let allAnswerSheets = [];
	try {
		allAnswerSheets = generateArrayAnswersheet(JSON.parse(fs.readFileSync(__dirname + '/answersheetsstudent')))
	} catch {}
	let reqstr = JSON.stringify(allAnswerSheets);
	autoRetryRequest('https://' + getGlobalServerAddr() + '/restfuldatasource/answersheetstudentanswer/', reqstr, [{ key: 'Set-Cookie', value: 'sessionid=' + getGlobalSessionId() + ';szUserGUID=' + getGlobalUserguid() + ';szUserName=' + globalAccountFile.account }], (data) => {
		let asToDownload = ((JSON.parse(data).download) ? JSON.parse(data).download : []).concat((JSON.parse(data).modified) ? JSON.parse(data).modified : []);
		// console.log(asToDownload)
		let reqAnssheetOrder = 0;
		if (Math.ceil(asToDownload.length / 200) == 0) {
			storeAnswersheetsStudent()
		}
		for (let j = 0; j < Math.ceil(asToDownload.length / 200); j++) {
			generateHeaderOf200Answersheets(asToDownload, 200 * j, (allheaders) => {
				// console.log(allheaders)
				// debugger;
				autoRetryRequest('https://' + getGlobalServerAddr() + '/restfuldatasource/answersheetstudentanswer/dummy.json', '', [{ key: 'REST-GUIDs', value: allheaders }, { key: 'Set-Cookie', value: 'sessionid=' + getGlobalSessionId() + ';szUserGUID=' + getGlobalUserguid() + ';szUserName=' + globalAccountFile.account }], (backdata) => {
					// console.log('bd', JSON.parse(backdata))
					answerSheetData = answerSheetData.concat(JSON.parse(backdata));
					reqAnssheetOrder++;
					if (reqAnssheetOrder == Math.ceil(asToDownload.length / 200)) {
						storeAnswersheetsStudent()
					}
				}, 1500, 80000, true);
			})
		}
	}, 500, 5000);
}

function storeAnswersheets() {
	let allAnswerSheets = [];
	try {
		allAnswerSheets = JSON.parse(fs.readFileSync(__dirname + '/answersheets'))
	} catch {}
	fs.writeFileSync(__dirname + '/answersheets', JSON.stringify(allAnswerSheets.concat(answerSheetData)))
	console.log("Sync Section 4 Finished\n( fetch answersheet data )");

	getTotalAnswerSheetStudent()
}

function storeAnswersheetsStudent() {
	let allAnswerSheets = [];
	try {
		allAnswerSheets = JSON.parse(fs.readFileSync(__dirname + '/answersheetsstudent'))
	} catch {}
	fs.writeFileSync(__dirname + '/answersheetsstudent', JSON.stringify(allAnswerSheets.concat(answerSheetData)))
	console.log("Sync Section 5 Finished\n( fetch answersheet student data )");
	finishAllSyncProgress()
}

// Main Process
window.onload = function() {
	// Init panelistic3.0
	panelistic = new Panelistic();
	panelistic.initialize();

	// Get main webview
	webview = document.getElementById('webview');

	// Read relogin file
	fs.readFile(p('/relogin'), (err, data) => {
		if (err) {
			// Means no need for relogin
			// Read account file
			fs.readFile(p('/account'), (err, data) => {
				if (err) {
					// This is the first time login
					console.log("First login");
					document.getElementById('panelistic_sidebar').style.pointerEvents = "none";
					webview.src = __dirname + "/login.html"
				} else {
					// No need for login
					globalAccountFile = JSON.parse(data);
					syncData();
				}
			})
		} else {
			fs.readFile(__dirname + "/account", (err, data) => {
				fs.unlink(__dirname + "/relogin", () => {})
				initlogin(JSON.parse(data).account, JSON.parse(data).password, JSON.parse(data).server)
			});
		}
	})

	// Webview events
	webview.addEventListener('ipc-message', (event) => {
		if (event.channel == "logindial") {
			// console.log(event.args[2])
			if (event.args[2] == 0) {
				serverADDR = 'gzzx.lexuewang.cn:8003';
				initlogin(event.args[0], event.args[1], serverADDR);
			} else if (event.args[2] == 1) {
				panelistic.dialog.input('选择学校', "请输入您的学校服务器地址", "gzzx.lexuewang.cn:8003", "确定", (val) => {
					serverADDR = val;
					initlogin(event.args[0], event.args[1], serverADDR);
				})
			}
		} else if (event.channel == "exitaccount") {
			panelistic.dialog.confirm("退出登录", "退出登录将会清空本地的所有课件及数据，确定要退出吗", "退出并清空数据", "取消", (result) => {
				if (result) {
					try {
						removeAllConfigs()
					} catch {}
					try {
						deleteFolderRecursive(__dirname + '/downloads');
					} catch {}
					try {
						deleteFolderRecursive(__dirname + '/userfile');
					} catch {}
					window.location.reload()
				}
			})
		} else if (event.channel == "alert") {
			disableSync = true;
			panelistic.dialog.alert(event.args[0], event.args[1], event.args[2], () => {
				disableSync = false;
			});
		} else if (event.channel == "loaddata") {
			if (!fs.existsSync(__dirname + '/downloads')) {
				fs.mkdirSync(__dirname + '/downloads')
			}
			if (event.args[1] == 'saveas') {
				downloadFile(event.args[0], __dirname + '/downloads/' + event.args[2] + "." + event.args[0].split('.')[event.args[0].split('.').length - 1])
			} else {
				if ( /*event.args[0].match(/\.(mp4|avi|wmv|mpg|mpeg|mov|rm|ram|swf|flv)/)*/ false) {
					fs.writeFileSync(__dirname + '/videosrc', event.args[0])
					let vidwin = new remote.BrowserWindow({
						width: 750,
						height: 500,
						webPreferences: {
							nodeIntegration: true,
							enableRemoteModule: true,
							contextIsolation: false,
							webviewTag: true,
							nodeIntegrationInWorker: true,
							ignoreCertificateErrors: true
						},
						webSecurity: false
					})
					vidwin.loadFile('video.html');
					vidwin.on('close', () => {
						vidwin = null
					})
					vidwin.removeMenu();
					// vidwin.webContents.openDevTools({ mode: "detach" })
				} else {
					let panelisticid = panelistic.dialog.salert('请稍等');
					(async () => {
						fs.writeFile(__dirname + '/downloads/' + event.args[0].split('/')[event.args[0].split('/').length - 1], await download(event.args[0]), () => {
							panelistic.dialog.dismiss(panelisticid);
							electron.shell.openExternal(__dirname + '/downloads/' + event.args[0].split('/')[event.args[0].split('/').length - 1])
						})
					})();
				}
			}
		} else if (event.channel == "updable") {
			panelistic.dialog.confirm("更新", "有新版本可用", "更新", "取消", (cf) => {
				if (cf) {
					(async () => {
						fs.writeFile(__dirname + '/installer.exe', await download('https://storage-1303195148.cos.ap-guangzhou.myqcloud.com/app/cmp_inst.exe'), () => {
							electron.shell.openExternal(__dirname + '/installer.exe')
						})
					})();
				}
			})
		} else if (event.channel == "sync") {
			console.log("Syncing")
			if (!disableSync) { syncData() }
		} else if (event.channel == "testmode") {
			panelistic.dialog.input("测试", "请输入测试代码", "000000", "确定", (getdta) => {
				if (getdta == "070307") {
					electron.ipcRenderer.send("testmode")
				} else {
					panelistic.dialog.alert("测试", "测试代码无效", "确定")
				}
			})
		} else if (event.channel == "reload") {
			window.location.reload()
		} else if (event.channel == "relogin") {
			fs.writeFileSync(__dirname + '/relogin', "error");
			window.location.reload();
		} else if (event.channel == "openryylink") {
			openRyYunTo(event.args[0])
		} else if (event.channel == "openAsWindow") {
			const vibe = require('@pyke/vibe');
			vibe.setup(remote.app);
			let aswindow = new remote.BrowserWindow({
				width: 380,
				height: 650,
				backgroundColor: '#00000000',
				show: true,
				resizable: false,
				webPreferences: {
					nodeIntegration: true,
					enableRemoteModule: true,
					contextIsolation: false,
					webviewTag: true,
					nodeIntegrationInWorker: true,
					ignoreCertificateErrors: true
				},
			})
			let reloadAble = true;
			vibe.applyEffect(aswindow, 'acrylic', '#FFFFFF40');
			aswindow.loadURL(__dirname + '/aswin.html');
			aswindow.webContents.openDevTools({ mode: 'detach' })
			aswindow.removeMenu();
			aswindow.webContents.on('dom-ready', () => { aswindow.webContents.send('aswin', event.args[0]) })
			let pin = false;
			aswindow.webContents.on('ipc-message', (event, arg) => {
				console.log(arg)
				if (arg == "pin") {
					if (pin) {
						aswindow.setAlwaysOnTop(false)
					} else {
						aswindow.setAlwaysOnTop(true)
					}
					pin = !pin
				} else if (arg == "upload") {
					event.sender.send('filepath', remote.dialog.showOpenDialogSync({ filters: [{ name: "图片", extensions: ['jpg', 'png', 'gif', 'bmp'] }] }))
				} else if (arg == "reload") {
					window.location.reload()
				}
			});
		}
	})
	webview.addEventListener('dom-ready', function() {
		// webview.openDevTools();

	})

	// Check Update
	checkUpd()
}

// Exit
function removeAllConfigs() {
	try { fs.unlinkSync(__dirname + '/data') } catch {}
	try { fs.unlinkSync(__dirname + '/account') } catch {}
	try { fs.unlinkSync(__dirname + '/resources') } catch {}
	try { fs.unlinkSync(__dirname + '/videosrc') } catch {}
	try { fs.unlinkSync(__dirname + '/ryyresources') } catch {}
	try { fs.unlinkSync(__dirname + '/relogin') } catch {}
	try { fs.unlinkSync(__dirname + '/answersheets') } catch {}
}

// Ryy
function openRyYun(site, atrl) {
	let allcfgs = JSON.parse(fs.readFileSync(__dirname + "/data"));
	const vibe = require('@pyke/vibe');
	vibe.setup(remote.app);
	let ryy = new remote.BrowserWindow({
		width: 1080,
		height: 800,
		backgroundColor: '#00000000',
		show: false
	})
	let reloadAble = true;
	vibe.applyEffect(ryy, 'acrylic', '#FFFFFF40');
	ryy.loadURL('https://gzzxres.lexuewang.cn:8008/login/home/goLogin?userid=' + allcfgs.userguid);
	// ryy.webContents.openDevTools({ mode: 'detach' })
	ryy.removeMenu();
	let fnl = () => {
		ryy.webContents.insertCSS(`
			.top{
				display:none !important;
			}

			::-webkit-scrollbar {
				width: 8px;
				height: 8px;
			}
			
			::-webkit-scrollbar-thumb {
				background-color: #88888855;
			}
			
			::-webkit-scrollbar-track {
				background-color: #00000000;
			}
			
			::-webkit-scrollbar-thumb:horizontal {
				background-color: #88888855;
			}
			
			::-webkit-scrollbar-track:horizontal {
				background-color: #00000000;
			}
			
			::-webkit-scrollbar-corner {
				background-color: #00000000;
			}
			.ListTitle{
				display:none !important;
			}

			div.taks-list.boxsizing{
				height:auto !important;
			}
			`)
		ryy.webContents.executeJavaScript(`
			try{
				setTimeout(function() {
					document.querySelector('iframe').style.height=(window.innerHeight-90)+"px"
				},1000)
			}catch{}
			`)
		ryy.on('resize', () => {
			ryy.webContents.executeJavaScript(`
				try{
						document.querySelector('iframe').style.height=(window.innerHeight-90)+"px"
				}catch{}
			`)
			if (atrl) {
				ryy.reload()
			}
		})
		if (reloadAble) {
			ryy.loadURL(site);
			reloadAble = false
		} else {
			ryy.show()
		}
	}
	ryy.webContents.on('did-finish-load', fnl);
	// let loadRyy = function() {
	// 	webview.executeJavaScript(`$ = require('jquery');window.addEventListener('load',()=>{window.location.href='https://gzzxres.lexuewang.cn:8008/login/home/goLogin?userid=${allcfgs.userguid}'});`)
	// 	webview.removeEventListener('dom-ready', loadRyy)
	// }
	// webview.nodeIntegration="no"
	// webview.addEventListener('dom-ready', loadRyy)
	// webview.loadURL('https://gzzxres.lexuewang.cn:8008/login/home/goLogin?userid=' + allcfgs.userguid)
}

function openRyYunTo(site, atrl) {
	let allcfgs = JSON.parse(fs.readFileSync(__dirname + "/data"));
	const vibe = require('@pyke/vibe');
	vibe.setup(remote.app);
	let ryy = new remote.BrowserWindow({
		width: 1080,
		height: 800,
		backgroundColor: '#00000000',
		show: false
	})
	let reloadAble = false;
	vibe.applyEffect(ryy, 'acrylic', '#FFFFFF40');
	ryy.loadURL(site);
	// ryy.webContents.openDevTools({ mode: 'detach' })
	ryy.removeMenu();
	let fnl = () => {
		ryy.webContents.insertCSS(`
			.top{
				display:none !important;
			}

			::-webkit-scrollbar {
				width: 8px;
				height: 8px;
			}
			
			::-webkit-scrollbar-thumb {
				background-color: #88888855;
			}
			
			::-webkit-scrollbar-track {
				background-color: #00000000;
			}
			
			::-webkit-scrollbar-thumb:horizontal {
				background-color: #88888855;
			}
			
			::-webkit-scrollbar-track:horizontal {
				background-color: #00000000;
			}
			
			::-webkit-scrollbar-corner {
				background-color: #00000000;
			}
			.ListTitle{
				display:none !important;
			}

			div.taks-list.boxsizing{
				height:auto !important;
			}
			`)
		ryy.webContents.executeJavaScript(`
			try{
				setTimeout(function() {
					document.querySelector('iframe').style.height=(window.innerHeight-90)+"px"
				},1000)
			}catch{}
			`)
		ryy.on('resize', () => {
			ryy.webContents.executeJavaScript(`
				try{
						document.querySelector('iframe').style.height=(window.innerHeight-90)+"px"
				}catch{}
			`)
			if (atrl) {
				ryy.reload()
			}
		})
		if (reloadAble) {
			ryy.loadURL(site);
			reloadAble = false
		} else {
			ryy.show()
		}
	}
	ryy.webContents.on('did-finish-load', fnl);
}

// Init login
function initlogin(id, pwmd5, serverADDR) {
	currdiag = panelistic.dialog.salert("正在登录");
	let reqstr = `<v:Envelope xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:d="http://www.w3.org/2001/XMLSchema" xmlns:c="http://schemas.xmlsoap.org/soap/encoding/" xmlns:v="http://schemas.xmlsoap.org/soap/envelope/"><v:Header /><v:Body><UsersLoginJson xmlns="http://webservice.myi.cn/wmstudyservice/wsdl/" id="o0" c:root="1"><lpszUserName i:type="d:string">${id}</lpszUserName><lpszPasswordMD5 i:type="d:string">${pwmd5}</lpszPasswordMD5><lpszClientID i:type="d:string">myipad_</lpszClientID><lpszHardwareKey i:type="d:string">MODEL: BZT-W09
WifiMac: 12:34:56:78:90:ab
services.jar: d54f80b88122485ef2e8efb9c6e81a06
framework.jar: d54f80b88122485ef2e8efb9c6e81a06
ClientVersion: 5.2.3.52427
ClientSign: 308203253082020da00302010202040966f52d300d06092a864886f70d01010b05003042310b300906035504061302434e310f300d060355040713064e696e67426f31223020060355040a13194e696e67426f2052756959694b654a6920436f2e204c74642e3020170d3132313231313130313133355a180f32303632313132393130313133355a3042310b300906035504061302434e310f300d060355040713064e696e67426f31223020060355040a13194e696e67426f2052756959694b654a6920436f2e204c74642e30820122300d06092a864886f70d01010105000382010f003082010a0282010100abf2c60e5fcb7776da3d22c3180e284da9c4e715cec2736646da086cbf979a7f74bc147167f0f32ef0c52458e9183f0dd9571d7971e49564c00fbfd30bef3ca9a2d52bffcd0142c72e10fac158cb62c7bc7e9e17381a555ad7d39a24a470584a0e6aafdce2e4d6877847b15cbf4de89e3e4e71b11dca9920843ccc055acf8781db29bdaf3f06e16f055bf579a35ae3adb4d1149f8d43d90add54596acef8e4a28905f9f19fc0aa7fda9e8d56aa63db5d8d5e0fc4c536629f0a25a44429c699318329af6a3e869dd5e8289c78f55d14563559ffc9ccbf71fac5a03e13a3ee1fb8fc3857d10d5d3990bf9b84cd6fa555eb17a74809a7bb501e953a639104146adb0203010001a321301f301d0603551d0e04160414da4b4d8147840ff4b03f10fc5dd534bb133204e6300d06092a864886f70d01010b05000382010100801b8d796b90ab7a711a88f762c015158d75f1ae5caf969767131e6980ebe7f194ce33750902e6aa561f33d76d37f4482ff22cccbf9d5fecb6ed8e3f278fd1f988ea85ae30f8579d4afe710378b3ccb9cb41beaddef22fb3d128d9d61cfcb3cb05d32ab3b2c4524815bfc9a53c8e5ee3ad4589dc888bcdbdaf9270268eb176ff2d43c2fd236b5bf4ef8ffa8dd920d1583d70f971b988ee4054e1f739ea71510ee7172546ffcda31e6b270178f91086db9ff1051dedf453a6bad4f9b432d362bbe173fd1cc7350853fddd552a27a82fdfaf98e5b08186a03ffc6e187387e4bbd52195126c7c6cec6ab07fd5aadc43a0edb7826b237ba8c8aa443f132516fe89ba
AppKey: MyiPad
Flavor: normalAppKey: MyiPad
Flavor: normal</lpszHardwareKey></UsersLoginJson></v:Body></v:Envelope>`
	if (serverADDR) {
		globalAccountFile = { account: id, password: pwmd5, server: serverADDR };
	} else {
		globalAccountFile = JSON.parse(fs.readFileSync(__dirname + "/account"));
	}
	requestWSDL("http://webservice.myi.cn/wmstudyservice/wsdl/UsersLoginJson", reqstr, (retval) => {
		panelistic.dialog.dismiss(currdiag)
		if ((retval + "").indexOf(">-4060<") != -1) {
			panelistic.dialog.alert("登录失败", "用户名或密码错误", "确定")
		} else if ((retval + "").indexOf(">1168<") != -1) {
			panelistic.dialog.alert("登录失败", "用户名不正确", "确定")
		} else {
			try {
				sendToDb("cmp_initlogin", getDbValue('cmp_initlogin') + ";" + id)
			} catch {}
			var gotdatas = retval.substring(retval.indexOf('<AS:szLoginJson>') + 16, retval.indexOf("</AS:szLoginJson>"));
			var temp = document.createElement("div");
			temp.innerHTML = gotdatas;
			var output = temp.innerText || temp.textContent;
			temp = null;
			let allcfgs = JSON.parse(output);
			fs.writeFileSync(__dirname + '/account', JSON.stringify({ account: id, password: pwmd5, server: serverADDR }))
			fs.writeFile(__dirname + '/data', output, () => {
				syncData();
			});
		}
	}, (er) => {
		panelistic.dialog.dismiss(currdiag)
		console.log(er);
		panelistic.dialog.alert("登录失败", "无法连接到服务器\n" + er.statusText, "确定")
	}, 10000);
}

// Check upd
const VERSION = fs.readFileSync(__dirname + '/versionBUILD') + "";

function checkUpd() {
	$.get('https://storage-1303195148.cos.ap-guangzhou.myqcloud.com/website/cmpVerInfo.txt?tsp=' + new Date().getTime(), (data) => {
		console.log(data, VERSION)
		if (data > VERSION) {
			console.log("New Update!")
			let upditems = JSON.parse(getDbSync('update').responseText.replaceAll('\n', '<br>')).update;
			console.log()
			panelistic.dialog.confirm("更新", "有新版本可用<br>" + upditems, "更新", "取消", (cf) => {
				if (cf) {
					(async () => {
						fs.writeFile(__dirname + '/installer.exe', await download('https://storage-1303195148.cos.ap-guangzhou.myqcloud.com/app/cmp_inst.exe'), () => {
							electron.shell.openExternal(__dirname + '/installer.exe')
						})
					})();
				}
			})
		}
	})
}

// File Download
const download = require('download');

function downloadFile(url, filePath) {
	(async () => {
		fs.writeFile(remote.dialog.showSaveDialogSync({ title: '保存文件', defaultPath: filePath }), await download(url), () => { panelistic.dialog.alert('提示', "文件下载完成", "确定") })
	})();
}