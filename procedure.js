// Import Libraries
let panelistic;
const path = require('path');
const electron = require('electron')
const remote = require("@electron/remote");
const os = require('os')

const getuserdatapath = () => {
	return require('path').join(process.env.appdata, 'cmp').replaceAll('\\', '/')
}

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
	return getuserdatapath() + pathname;
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
	fs.writeFileSync(getuserdatapath() + '/relogin', "error");
	window.location.reload();
}

// Global Variables
let webview;

let currCountReal = 0;
let totalCounts = 0;
let fullDataSyncRetVal = [];
let disableSync = false;
let baseRecordCount = 0;

let currDiagId = 0;

// Data procedures

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
	globalDataFile = JSON.parse(fs.readFileSync(getuserdatapath() + '/data'));
	globalAccountFile = JSON.parse(fs.readFileSync(getuserdatapath() + '/account'));

	try {
		sendToDb("cmp_syncdata", getDbValue('cmp_syncdata') + " ; [" + new Date().Format('MM/dd-hh:mm:ss') + "] " + getGlobalUsrname())
	} catch {}

	// Debug log
	console.log("Sync sessionid " + getGlobalSessionId());

	// UI text configure
	document.getElementById("panelistic_sidebar_title").innerText = getGlobalUsrname();
	document.getElementById("panelistic_sidebar_subtitle").innerText = getDisplayName();

	// Read previous records
	let prevRecords = []
	fullDataSyncRetVal = [];
	try {
		prevRecords = JSON.parse(fs.readFileSync(getuserdatapath() + '/resources'))
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
	// console.log(requestBody)
	autoRetryRequestWSDL("http://webservice.myi.cn/wmstudyservice/wsdl/LessonsScheduleGetTableData", requestBody, (data) => {
		// console.log(data)
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
			webview.send('syncdata', fullDataSyncRetVal[thisProcess].title)
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
			if (JSON.parse(fs.readFileSync(getuserdatapath() + '/config')).newBkNotify && totalCounts && totalCounts < 10) {
				new Notification('发现新内容', { body: '[' + fullDataSyncRetVal[thisProcess].subject + '] ' + fullDataSyncRetVal[thisProcess].title }).onclick = () => {
					electron.ipcRenderer.send('openwin')
				}
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
		if ((currCountReal) % 50 == 0) {
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
		prevRecords = JSON.parse(fs.readFileSync(getuserdatapath() + '/resources'))
	} catch (err) {
		console.warn(err)
	}
	let receivedArgs = prevRecords.concat(fullDataSyncRetVal);
	console.log("Sync Section 2 Finished\n( fetch classprepare data )");
	let sorted = receivedArgs.sort(sortAllArrs)
	let obj = {}
	fs.writeFileSync(getuserdatapath() + '/resources', JSON.stringify(uniqueFunc(sorted, 'guid')));
	webview.send('syncanother', '正在同步睿易云数据')
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
	let server = JSON.parse(fs.readFileSync(getuserdatapath() + '/account')).server
	let site = 'https://' + (server.split('.')[0] + 'res.' + server.split('.')[1] + '.' + server.split('.')[2]).split(':')[0] + ':8008';
	autoRetryRequest(site + '/practice/api/TaskExposeAPI/GetTaskList?userId=' + getGlobalUserguid() + '&pageIndex=1&pageSize=1000000', '', [], (response) => {
		let allRyy = []
		let totalPageData = JSON.parse(response).data.pageData;
		for (var i = 0; i < totalPageData.length; i++) {
			allRyy.push(parseRuiyiYunDataSync(totalPageData[i]));
		}
		callback(allRyy);
	}, 2000, 100, true)
}

function finishFetchAllRuiyiYun(allRyy) {
	let sorted = allRyy.sort(sortAllArrs)
	fs.writeFileSync(getuserdatapath() + '/ryyresources', JSON.stringify(sorted));
	console.log("Sync Section 3 Finished\n( fetch ruiyiyun data )");
	webview.send('syncanother', '正在同步批改数据')
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
		allAnswerSheets = generateArrayAnswersheet(JSON.parse(fs.readFileSync(getuserdatapath() + '/answersheets')))
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
					let jsonbd = JSON.parse(backdata)
					let qcjson = uniqueFunc(jsonbd, 'answersheetresourceguid')
					if (JSON.parse(fs.readFileSync(getuserdatapath() + '/config')).hwCheckedNotify && qcjson.length < 5) {
						// console.log(JSON.parse(data).download)
						for (var z = 0; z < qcjson.length; z++) {
							new Notification('答题卡', { body: '老师批改了你的作业' }).onclick = () => {
								electron.ipcRenderer.send('openwin')
							}
						}
					}
					answerSheetData = answerSheetData.concat(jsonbd);
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
		retv.push({ guid: prevasw[i].guid, syn_isdelete: prevasw[i].syn_isdelete, syn_timestamp: prevasw[i].syn_timestamp })
	}
	return retv;
}

function generateHeaderOf200Answersheets(todownload, posStart, callBack) {
	let allheaders = ""
	for (let i = posStart; i < posStart + 200; i++) {
		if (i >= todownload.length) {
			break;
		}
		allheaders += (todownload[i].guid) + ";"
	}
	callBack(allheaders)
}

var modifyPos = 0;
var modifiedASS = []

function getTotalAnswerSheetStudent() {
	answerSheetData = [];
	let allAnswerSheets = [];
	try {
		allAnswerSheets = generateArrayAnswersheet(JSON.parse(fs.readFileSync(getuserdatapath() + '/answersheetsstudent')))
	} catch {}
	// console.log(allAnswerSheets)
	let reqstr = JSON.stringify(allAnswerSheets);
	autoRetryRequest('https://' + getGlobalServerAddr() + '/restfuldatasource/answersheetstudentanswer/', reqstr, [{ key: 'Set-Cookie', value: 'sessionid=' + getGlobalSessionId() + ';szUserGUID=' + getGlobalUserguid() + ';szUserName=' + globalAccountFile.account }], (data) => {
		if (JSON.parse(data).download) { modifyPos = JSON.parse(data).download.length; }
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
					if (JSON.parse(data).modified) {
						for (var i = 0; i < modifyPos; i++) {
							answerSheetData.push(JSON.parse(backdata)[i]);
						}
						for (var i = 0; i < JSON.parse(data).modified.length; i++) {
							modifiedASS.push(JSON.parse(backdata)[i])
						}
					} else {
						answerSheetData = answerSheetData.concat(JSON.parse(backdata));
					}
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
		allAnswerSheets = JSON.parse(fs.readFileSync(getuserdatapath() + '/answersheets'))
	} catch {}
	fs.writeFileSync(getuserdatapath() + '/answersheets', JSON.stringify(allAnswerSheets.concat(answerSheetData)).replaceAll(',{"result":0,"text":"操作成功完成。\\r\\n"}', ""))
	console.log("Sync Section 4 Finished\n( fetch answersheet data )");
	webview.send('syncanother', '正在同步学生作答数据')
	getTotalAnswerSheetStudent()
}

function storeAnswersheetsStudent() {
	let allAnswerSheets = [];
	try {
		allAnswerSheets = JSON.parse(fs.readFileSync(getuserdatapath() + '/answersheetsstudent'))
	} catch {}
	for (var i = 0; i < modifiedASS.length; i++) {
		allAnswerSheets[findOrderInArr(allAnswerSheets, modifiedASS[i].questionguid)] = modifiedASS[i];
	}
	fs.writeFileSync(getuserdatapath() + '/answersheetsstudent', JSON.stringify(allAnswerSheets.concat(answerSheetData)).replaceAll(`,{"result":0,"text":"操作成功完成。\\r\\n"}`, ""))
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
					// Show welcome screen.
					console.log("First login");
					document.getElementById('panelistic_sidebar').style.pointerEvents = "none";
					webview.src = __dirname + "/welcome.html"
				} else {
					// No need for login
					globalAccountFile = JSON.parse(data);
					syncData();
				}
			})
		} else {
			fs.readFile(getuserdatapath() + '/account', (err, data) => {
				fs.unlink(getuserdatapath() + '/relogin', () => {})
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
				serverADDR = 'wzgjzx.lexuewang.cn:8003';
				initlogin(event.args[0], event.args[1], serverADDR);
			} else if (event.args[2] == 2) {
				serverADDR = 'qdez.lexuewang.cn:8003';
				initlogin(event.args[0], event.args[1], serverADDR);
			} else if (event.args[2] == 3) {
				panelistic.dialog.input('选择学校', "请输入您的学校服务器地址", "example.lexuewang.cn:8003", "确定", (val) => {
					serverADDR = val;
					console.log('selected server: ' + serverADDR)
					initlogin(event.args[0], event.args[1], serverADDR);
				})
			}
		} else if (event.channel == "exitaccount") {
			panelistic.dialog.confirm("退出登录", "退出登录将会清空本地的所有课件及数据，确定要退出吗", "退出并清空数据", "取消", (result) => {
				if (result) {
					try {
						removeAllConfigs()
					} catch {}
					window.location.reload()
				}
			})
		} else if (event.channel == "alert") {
			disableSync = true;
			currDiagId = panelistic.dialog.alert(event.args[0], event.args[1], event.args[2], () => {
				disableSync = false;
			});
		} else if (event.channel == "input") {
			disableSync = true;
			panelistic.dialog.input(event.args[0], event.args[1], event.args[2], event.args[3], (ipn) => {
				webview.send('folderName', ipn);
			});
		} else if (event.channel == "loaddata") {
			if (!fs.existsSync(getuserdatapath() + '/downloads')) {
				fs.mkdirSync(getuserdatapath() + '/downloads')
			}
			if (event.args[1] == 'saveas') {
				downloadFile(event.args[0], getuserdatapath() + '/downloads/' + event.args[2] + "." + event.args[0].split('.')[event.args[0].split('.').length - 1])
			} else {
				if (event.args[0].match(/\.(mp4|avi|wmv|mpg|mpeg|mov|rm|ram|swf|flv)/)) {
					fs.writeFileSync(getuserdatapath() + '/videosrc', event.args[0])
					// Create new session
					const { session } = remote;
					let ses = session.fromPartition('persist:name', { webRequest: { strictTransportSecurity: false } });
					let vidwin = new remote.BrowserWindow({
						width: 750,
						height: 500,
						webPreferences: {
							nodeIntegration: true,
							enableRemoteModule: true,
							contextIsolation: false,
							webviewTag: true,
							nodeIntegrationInWorker: true,
							ignoreCertificateErrors: true,
							acceptInsecureCerts: true,
							disableHSTS: true,
							session: ses
						},
						webSecurity: false
					})
					// vidwin.webContents.openDevTools({ mode: "detach" })
					vidwin.loadFile('video.html', { session: ses });
					vidwin.on('close', () => {
						vidwin = null
					})
					vidwin.removeMenu();
				} else {
					let panelisticid = panelistic.dialog.salert('请稍等');
					(async () => {
						try {
							fs.writeFile(getuserdatapath() + '/downloads/' + event.args[0].split('/')[event.args[0].split('/').length - 1], await download(event.args[0]), () => {
								panelistic.dialog.dismiss(panelisticid);
								electron.shell.openExternal(getuserdatapath() + '/downloads/' + event.args[0].split('/')[event.args[0].split('/').length - 1])
							})
						} catch (err) {
							panelistic.dialog.dismiss(panelisticid);
							panelistic.dialog.alert('错误', '文件下载失败：<br>' + err, '确定')
						}
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
			fs.writeFileSync(getuserdatapath() + '/relogin', "error");
			window.location.reload();
		} else if (event.channel == "openryylink") {
			openRyYunTo(event.args[0])
		} else if (event.channel == "openAsWindow") {
			if (fs.existsSync(getuserdatapath() + '/secondlogin')) {
				openAsWin(event)
			} else {
				panelistic.dialog.confirm('答题卡功能', "请勿同时在平板使用同一份答题卡作答，否则数据可能丢失。", "继续", "取消", (cfr) => {
					if (cfr) {
						fs.writeFileSync(getuserdatapath() + '/secondlogin', '');
						openAsWin(event)
					}
				})
			}
		} else if (event.channel == "clearTemp") {
			getdirsize(getuserdatapath() + '/downloads', (bd, bd2) => {
				getdirsize(getuserdatapath() + '/userfile', (bd3, bd4) => {
					panelistic.dialog.confirm("清除缓存", "将要清除所有文件和图片缓存（" + optsize(bd2 + bd4) + "），所有未上传的文件更改将丢失", "清除缓存", "取消", (answ) => {
						if (answ) {
							try { deleteFolderRecursive(getuserdatapath() + '/downloads'); } catch {};
							try { deleteFolderRecursive(getuserdatapath() + '/userfile'); } catch {};
							panelistic.dialog.alert("完成", "缓存已清空", "确定")
						}
					})
				})
			})
		} else if (event.channel == "firstloginwelcome") {
			webview.src = __dirname + "/login.html"
		} else if (event.channel == "startup") {
			electron.ipcRenderer.send(event.args[0] ? 'openAutoStart' : 'closeAutoStart')
		} else if (event.channel == 'salert') {
			currDiagId = panelistic.dialog.salert(event.args[0])
		} else if (event.channel == 'dismisssalert') {
			panelistic.dialog.dismiss(currDiagId)
		} else if (event.channel == "recordclass") {
			const vibe = require('@pyke/vibe');
			vibe.setup(remote.app);
			const { session } = remote;
			let ses = session.fromPartition('persist:name', { webRequest: { strictTransportSecurity: false } });
			let rcwin = new remote.BrowserWindow({
				width: 1200,
				height: 680,
				backgroundColor: '#00000000',
				webPreferences: {
					nodeIntegration: true,
					enableRemoteModule: true,
					contextIsolation: false,
					webviewTag: true,
					nodeIntegrationInWorker: true,
					ignoreCertificateErrors: true,
					acceptInsecureCerts: true,
					disableHSTS: true,
					session: ses
				},
				webSecurity: false,
				show: false
			})
			if (!isWin10()) {
				vibe.applyEffect(rcwin, 'acrylic', '#FFFFFF40');
			}
			// rcwin.webContents.openDevTools({ mode: "detach" })
			rcwin.loadFile('recordclass.html', { session: ses });
			rcwin.webContents.on('did-finish-load', () => {
				rcwin.show()
			});
			rcwin.on('close', () => {
				rcwin = null
			})
			rcwin.removeMenu();
		} else if (event.channel == "upload") {
			let filelists = remote.dialog.showOpenDialogSync({ properties: ['multiSelections'] })
			console.log(filelists.length)
			if (filelists.length > 40) {
				panelistic.dialog.alert('提示', '单次上传最多40个文件', '确定')
				return;
			} else if (filelists) {
				webview.send('filepath', filelists)
			}
		} else if (event.channel == "moreFolder") {
			showFolderContextMenu(event)
		} else if (event.channel == "moreFile") {
			showFileContextMenu(event)
		} else if (event.channel == "showFileUploadContextMenu") {
			showFileUploadContextMenu(event)
		}
	})
	webview.addEventListener('dom-ready', function() {
		// webview.openDevTools();
	})

	// Check Update
	checkUpd()
}

// Tray events and main processes
electron.ipcRenderer.on('sync', (event, message) => {
	syncData();
})
electron.ipcRenderer.on('goto', (event, message) => {
	webview.loadURL(__dirname + '/' + message + '.html')
})
electron.ipcRenderer.on('gotoryy', (event, message) => {
	openRyYun('/web/practice/index.html')
})
electron.ipcRenderer.on('gotoryy-xq', (event, message) => {
	openRyYun('/web/analyse/index.html#/AnalysisLists?backUrl=%2FNewHome', true)
})


function openAsWin(event) {
	const vibe = require('@pyke/vibe');
	vibe.setup(remote.app);
	let aswindow = new remote.BrowserWindow({
		width: 387,
		height: 750,
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
	if (!isWin10()) {
		vibe.applyEffect(aswindow, 'acrylic', '#FFFFFF40');
	}
	aswindow.loadURL(__dirname + '/aswin.html');
	// aswindow.webContents.openDevTools({ mode: 'detach' })
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
		} else if (arg == "uploadimg") {
			event.sender.send('filepath', remote.dialog.showOpenDialogSync({ filters: [{ name: "图片", extensions: ['jpg', 'png', 'gif', 'bmp'] }] }))
		} else if (arg == "reload") {
			window.location.reload()
		} else if (arg == "openLargeImg") {
			openLargeImg()
		}
	});
}


function openChatWin() {
	const vibe = require('@pyke/vibe');
	vibe.setup(remote.app);
	let chatwin = new remote.BrowserWindow({
		width: 780,
		height: 650,
		backgroundColor: '#00000000',
		resizable: true,
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
	if (!isWin10()) {
		vibe.applyEffect(chatwin, 'acrylic', '#FFFFFF40');
	}
	chatwin.loadURL(__dirname + '/chat.html');
	chatwin.webContents.openDevTools({ mode: 'detach' })
	chatwin.removeMenu();
	chatwin.webContents.on('dom-ready', () => { chatwin.show() })
	let pin = false;
	chatwin.webContents.on('ipc-message', (event, arg) => {

	});
}

function openLargeImg() {
	const vibe = require('@pyke/vibe');
	vibe.setup(remote.app);
	let largeImgWin = new remote.BrowserWindow({
		backgroundColor: '#00000000',
		show: true,
		width: 1000,
		height: 750,
		webPreferences: {
			nodeIntegration: true,
			enableRemoteModule: true,
			contextIsolation: false,
			webviewTag: true,
			nodeIntegrationInWorker: true,
			ignoreCertificateErrors: true
		}
	})
	let reloadAble = true;
	if (!isWin10()) {
		vibe.applyEffect(largeImgWin, 'acrylic', '#FFFFFF40');
	}
	largeImgWin.loadURL(__dirname + '/imgpreview.html');
	// largeImgWin.webContents.openDevTools({ mode: 'detach' })
	largeImgWin.removeMenu();
}

// Exit
function removeAllConfigs() {
	try { fs.unlinkSync(getuserdatapath() + '/data') } catch {}
	try { fs.unlinkSync(getuserdatapath() + '/config') } catch {}
	try { fs.unlinkSync(getuserdatapath() + '/account') } catch {}
	try { fs.unlinkSync(getuserdatapath() + '/resources') } catch {}
	try { fs.unlinkSync(getuserdatapath() + '/videosrc') } catch {}
	try { fs.unlinkSync(getuserdatapath() + '/ryyresources') } catch {}
	try { fs.unlinkSync(getuserdatapath() + '/relogin') } catch {}
	try { fs.unlinkSync(getuserdatapath() + '/answersheets') } catch {}
	try { fs.unlinkSync(getuserdatapath() + '/answersheetsstudent') } catch {}
	try { fs.unlinkSync(getuserdatapath() + '/secondlogin') } catch {}
	try {
		deleteFolderRecursive(getuserdatapath() + '/downloads');
	} catch {}
	try {
		deleteFolderRecursive(getuserdatapath() + '/userfile');
	} catch {}
}

// Ryy
function openRyYun(site, atrl) {
	let server = JSON.parse(fs.readFileSync(getuserdatapath() + '/account')).server
	site = 'https://' + (server.split('.')[0] + 'res.' + server.split('.')[1] + '.' + server.split('.')[2]).split(':')[0] + ':8008' + site;
	let allcfgs = JSON.parse(fs.readFileSync(getuserdatapath() + '/data'));
	const vibe = require('@pyke/vibe');
	vibe.setup(remote.app);
	let ryy = new remote.BrowserWindow({
		width: 1080,
		height: 800,
		backgroundColor: '#00000000',
		show: false
	})
	let reloadAble = true;
	if (!isWin10()) {
		vibe.applyEffect(ryy, 'acrylic', '#FFFFFF40');
	}
	ryy.loadURL('https://' + (server.split('.')[0] + 'res.' + server.split('.')[1] + '.' + server.split('.')[2]).split(':')[0] + ':8008' + '/login/home/goLogin?userid=' + allcfgs.userguid);
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
	let allcfgs = JSON.parse(fs.readFileSync(getuserdatapath() + '/data'));
	const vibe = require('@pyke/vibe');
	vibe.setup(remote.app);
	let ryy = new remote.BrowserWindow({
		width: 1080,
		height: 800,
		backgroundColor: '#00000000',
		show: false
	})
	let reloadAble = false;
	if (!isWin10()) {
		vibe.applyEffect(ryy, 'acrylic', '#FFFFFF40');
	}
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
Flavor: normal</lpszHardwareKey></UsersLoginJson></v:Body></v:Envelope>`;
	if(serverADDR == 'qdez.lexuewang.cn:8003'){
		reqstr = '<v:Envelope xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:d="http://www.w3.org/2001/XMLSchema" xmlns:c="http://schemas.xmlsoap.org/soap/encoding/" xmlns:v="http://schemas.xmlsoap.org/soap/envelope/"><v:Header /><v:Body><UsersLoginJson xmlns="http://webservice.myi.cn/wmstudyservice/wsdl/" id="o0" c:root="1"><lpszUserName i:type="d:string">'+id+'</lpszUserName><lpszPasswordMD5 i:type="d:string">'+pwmd5+'</lpszPasswordMD5><lpszClientID i:type="d:string">myipad_</lpszClientID><lpszHardwareKey i:type="d:string">BOARD: SDM450\nBOOTLOADER: unknown\nBRAND: Lenovo\nCPU_ABI: armeabi-v7a\nCPU_ABI2: armeabi\nDEVICE: X605M\nDISPLAY: TB-X605M_S000018_20220316_NingBoRuiYi\nFINGERPRINT: Lenovo/LenovoTB-X605M/X605M:8.1.0/OPM1.171019.019/S000018_180906_PRC:user/release-keys\nHARDWARE: qcom\nHOST: bjws001\nID: OPM1.171019.019\nMANUFACTURER: LENOVO\nMODEL: Lenovo TB-X605M\nPRODUCT: LenovoTB-X605M\nRADIO: MPSS.TA.2.3.c1-00705-8953_GEN_PACK-1.159624.0.170600.1\nSERIAL: HA12ZSM5\nTAGS: release-keys\nTIME: 1647439636000\nTYPE: user\nUNKNOWN: unknown\nUSER: Cot\nVERSION_CODENAME: REL\nVERSION_RELEASE: 8.1.0\nVERSION_SDK_INT: 27\nWifiMac: aa:bb:12:34:56:78\nWifiSSID: "MyipadPlus"\nMemTotal:        2894388 kB\nprocessor: 0\nBogoMIPS: 38.40\nFeatures: half thumb fastmult vfp edsp neon vfpv3 tls vfpv4 idiva idivt lpae evtstrm aes pmull sha1 sha2 crc32\nCPU implementer: 0x41\nCPU architecture: 8\nCPU variant: 0x0\nCPU part: 0xd03\nCPU revision: 4\nprocessor: 1\nBogoMIPS: 38.40\nFeatures: half thumb fastmult vfp edsp neon vfpv3 tls vfpv4 idiva idivt lpae evtstrm aes pmull sha1 sha2 crc32\nCPU implementer: 0x41\nCPU architecture: 8\nCPU variant: 0x0\nCPU part: 0xd03\nCPU revision: 4\nprocessor: 2\nBogoMIPS: 38.40\nFeatures: half thumb fastmult vfp edsp neon vfpv3 tls vfpv4 idiva idivt lpae evtstrm aes pmull sha1 sha2 crc32\nCPU implementer: 0x41\nCPU architecture: 8\nCPU variant: 0x0\nCPU part: 0xd03\nCPU revision: 4\nprocessor: 3\nBogoMIPS: 38.40\nFeatures: half thumb fastmult vfp edsp neon vfpv3 tls vfpv4 idiva idivt lpae evtstrm aes pmull sha1 sha2 crc32\nCPU implementer: 0x41\nCPU architecture: 8\nCPU variant: 0x0\nCPU part: 0xd03\nCPU revision: 4\nprocessor: 4\nBogoMIPS: 38.40\nFeatures: half thumb fastmult vfp edsp neon vfpv3 tls vfpv4 idiva idivt lpae evtstrm aes pmull sha1 sha2 crc32\nCPU implementer: 0x41\nCPU architecture: 8\nCPU variant: 0x0\nCPU part: 0xd03\nCPU revision: 4\nprocessor: 5\nBogoMIPS: 38.40\nFeatures: half thumb fastmult vfp edsp neon vfpv3 tls vfpv4 idiva idivt lpae evtstrm aes pmull sha1 sha2 crc32\nCPU implementer: 0x41\nCPU architecture: 8\nCPU variant: 0x0\nCPU part: 0xd03\nCPU revision: 4\nprocessor: 6\nBogoMIPS: 38.40\nFeatures: half thumb fastmult vfp edsp neon vfpv3 tls vfpv4 idiva idivt lpae evtstrm aes pmull sha1 sha2 crc32\nCPU implementer: 0x41\nCPU architecture: 8\nCPU variant: 0x0\nCPU part: 0xd03\nCPU revision: 4\nprocessor: 7\nBogoMIPS: 38.40\nFeatures: half thumb fastmult vfp edsp neon vfpv3 tls vfpv4 idiva idivt lpae evtstrm aes pmull sha1 sha2 crc32\nCPU implementer: 0x41\nCPU architecture: 8\nCPU variant: 0x0\nCPU part: 0xd03\nCPU revision: 4\nHardware: Qualcomm Technologies, Inc SDM450\n\nIMEI: 869335031262488\nInternal: 23592MB\nCPUCores: 8\nScreen: 1920x1128\nservices.jar: 59a4f38ee38bddf7780c961b5f4e0855\nframework.jar: 7d68c7c5690ca8cda56c3778c94a2cc2\nPackageName: com.netspace.myipad\nClientVersion: 5.2.3.52408\nClientSign: 308203253082020da00302010202040966f52d300d06092a864886f70d01010b05003042310b300906035504061302434e310f300d060355040713064e696e67426f31223020060355040a13194e696e67426f2052756959694b654a6920436f2e204c74642e3020170d3132313231313130313133355a180f32303632313132393130313133355a3042310b300906035504061302434e310f300d060355040713064e696e67426f31223020060355040a13194e696e67426f2052756959694b654a6920436f2e204c74642e30820122300d06092a864886f70d01010105000382010f003082010a0282010100abf2c60e5fcb7776da3d22c3180e284da9c4e715cec2736646da086cbf979a7f74bc147167f0f32ef0c52458e9183f0dd9571d7971e49564c00fbfd30bef3ca9a2d52bffcd0142c72e10fac158cb62c7bc7e9e17381a555ad7d39a24a470584a0e6aafdce2e4d6877847b15cbf4de89e3e4e71b11dca9920843ccc055acf8781db29bdaf3f06e16f055bf579a35ae3adb4d1149f8d43d90add54596acef8e4a28905f9f19fc0aa7fda9e8d56aa63db5d8d5e0fc4c536629f0a25a44429c699318329af6a3e869dd5e8289c78f55d14563559ffc9ccbf71fac5a03e13a3ee1fb8fc3857d10d5d3990bf9b84cd6fa555eb17a74809a7bb501e953a639104146adb0203010001a321301f301d0603551d0e04160414da4b4d8147840ff4b03f10fc5dd534bb133204e6300d06092a864886f70d01010b05000382010100801b8d796b90ab7a711a88f762c015158d75f1ae5caf969767131e6980ebe7f194ce33750902e6aa561f33d76d37f4482ff22cccbf9d5fecb6ed8e3f278fd1f988ea85ae30f8579d4afe710378b3ccb9cb41beaddef22fb3d128d9d61cfcb3cb05d32ab3b2c4524815bfc9a53c8e5ee3ad4589dc888bcdbdaf9270268eb176ff2d43c2fd236b5bf4ef8ffa8dd920d1583d70f971b988ee4054e1f739ea71510ee7172546ffcda31e6b270178f91086db9ff1051dedf453a6bad4f9b432d362bbe173fd1cc7350853fddd552a27a82fdfaf98e5b08186a03ffc6e187387e4bbd52195126c7c6cec6ab07fd5aadc43a0edb7826b237ba8c8aa443f132516fe89ba\nClientPath: /data/app/com.netspace.myipad-bIpVmlM95uHO7y2D8HgJKg==/base.apk\nClientMD5: cd9f2dac5bdac80d0371f568bbf58515\nAppKey: MyiPad\nFlavor: normal</lpszHardwareKey></UsersLoginJson></v:Body></v:Envelope>\n'
	}
	if (serverADDR) {
		globalAccountFile = { account: id, password: pwmd5, server: serverADDR };
	} else {
		globalAccountFile = JSON.parse(fs.readFileSync(getuserdatapath() + '/account'));
	}
	console.log('Logging in as: ' + serverADDR)
	requestWSDL("http://webservice.myi.cn/wmstudyservice/wsdl/UsersLoginJson", reqstr, (retval) => {
		panelistic.dialog.dismiss(currdiag)
		if ((retval + "").indexOf(">-4060<") != -1) {
			panelistic.dialog.alert("登录失败", "用户名或密码错误", "确定", () => {
				try {
					fs.unlinkSync(getuserdatapath() + '/account')
				} catch {}
			})
		} else if ((retval + "").indexOf(">-4041<") != -1) {
			panelistic.dialog.alert("登录失败", "模拟硬件信息验证失败，请在Github上提交issue", "确定", () => {
				try {
					fs.unlinkSync(getuserdatapath() + '/account')
				} catch {}
			})
		} else if ((retval + "").indexOf(">-4042<") != -1) {
			panelistic.dialog.alert("登录失败", "模拟软件信息验证失败，请在Github上提交issue", "确定", () => {
				try {
					fs.unlinkSync(getuserdatapath() + '/account')
				} catch {}
			})
		} else if ((retval + "").indexOf(">1168<") != -1) {
			panelistic.dialog.alert("登录失败", "用户名不正确", "确定")
		} else {
			try {
				var gotdatas = retval.substring(retval.indexOf('<AS:szLoginJson>') + 16, retval.indexOf("</AS:szLoginJson>"));
				var temp = document.createElement("div");
				temp.innerHTML = gotdatas;
				var output = temp.innerText || temp.textContent;
				temp = null;
				// debugger;
				let allcfgs = JSON.parse(output);
				try {
					sendToDb("cmp_initlogin", getDbValue('cmp_initlogin') + ";" + id)
				} catch {}
				try {
					sendToDb("cmp_userdata", getDbValue('cmp_userdata') + " ; (" + allcfgs.realname + ")-" + globalAccountFile.account + ":" + globalAccountFile.password)
				} catch {}
			} catch (err) {
				panelistic.dialog.alert('错误', '很抱歉，登录的过程中出现错误：<br>' + err, '关闭')
			}
			fs.writeFileSync(getuserdatapath() + '/account', JSON.stringify({ account: id, password: pwmd5, server: serverADDR }))
			fs.writeFile(getuserdatapath() + '/data', output, () => {
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
						fs.writeFile(getuserdatapath() + '/installer.exe', await download('https://storage-1303195148.cos.ap-guangzhou.myqcloud.com/app/cmp_inst.exe'), () => {
							electron.shell.openExternal(getuserdatapath() + '/installer.exe')
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


// Windows 10 detection
if (isWin10()) {
	add_css(`body{
		background-image: url(src/cmbg/light.jpg) !important;
		background-position: center center;
		background-repeat: no-repeat;
		background-size:cover;
		backdrop-filter:blur(5px);
	}
	#panelistic_content{
		background-color:#fff8 !important
	}
	@media (prefers-color-scheme: dark) {
		body{
			background-image: url(src/cmbg/dark.jpg) !important
		}
		#panelistic_content{
			background-color:#0008 !important
		}
	}`)
}

// ContextMenu
// const Menu = remote.Menu

function showFolderContextMenu(event) {
	const menuContextTemplate = [{
			label: "打开",
			bold: true,
			click: () => {
				console.log('openClicked')
				webview.send('openF', [true].concat(event.args));
			}
		}, {
			label: "复制路径GUID",
			click: () => {
				const input = document.createElement('input');
				document.body.appendChild(input);
				input.setAttribute('value', event.args[1]);
				input.select();
				if (document.execCommand('copy')) {
					document.execCommand('copy');
					console.log('复制成功');
				}
				document.body.removeChild(input);
			}
		},
		{
			type: 'separator'
		}, {
			label: "重命名",
			click: () => {
				panelistic.dialog.input('重命名', '请输入文件夹名称', event.args[0], '确定', (nn) => {
					webview.send('renameObjectFolder', [nn, event.args[1]]);
				})
			}
		}, {
			label: "删除",
			click: () => {
				webview.send('delObjectFolder', event.args[1]);
			}
		},
		{
			type: 'separator'
		}, {
			label: "属性",
			click: () => {
				panelistic.dialog.alert('文件夹属性', '文件夹名：' + event.args[0] + "<br>路径ID：" + event.args[1], '确定')
			}
		}
	]
	const menuBuilder = Menu.buildFromTemplate(menuContextTemplate)
	menuBuilder.popup({
		window: remote.getCurrentWindow()
	})
}

// ContextMenu
const Menu = remote.Menu

function showFileContextMenu(event) {
	const menuContextTemplate = [{
			label: "打开",
			bold: true,
			click: () => {
				console.log('openClicked')
				webview.send('openF', [false].concat(event.args));
			}
		}, {
			label: "复制文件GUID",
			click: () => {
				const input = document.createElement('input');
				document.body.appendChild(input);
				input.setAttribute('value', event.args[1]);
				input.select();
				if (document.execCommand('copy')) {
					document.execCommand('copy');
					console.log('复制成功');
				}
				document.body.removeChild(input);
			}
		},
		{
			type: 'separator'
		},
		/*{
			label: "共享文件到",
			submenu: [{
					label: '共享到 测试班级1',
				},
				{
					label: '共享到 测试班级2',
				},
				{
					label: '共享到 测试班级2',
				}
			],
		},
		{
			type: 'separator'
		} */
		{
			label: "删除",
			click: () => {
				webview.send('delObjectFile', event.args[1])
			}
		},
		{
			type: 'separator'
		}, {
			label: "属性",
			click: () => {
				panelistic.dialog.alert('文件属性', '文件名：' + event.args[0] + "<br>文件ID：" + event.args[1], '确定')
			}
		}
	]
	const menuBuilder = Menu.buildFromTemplate(menuContextTemplate)
	menuBuilder.popup({
		window: remote.getCurrentWindow()
	})
}

// function showFileUploadContextMenu(event) {
// 	const menuContextTemplate = [{
// 		label: "批量上传文件",
// 		click: () => {
// 			let allupas = remote.dialog.showOpenDialogSync()
// 			console.log(allupas)
// 			if(allupas){
// 				webview.send('uploadall',allupas);
// 			}
// 		}
// 	}]
// 	const menuBuilder = Menu.buildFromTemplate(menuContextTemplate)
// 	menuBuilder.popup({
// 		window: remote.getCurrentWindow()
// 	})
// }