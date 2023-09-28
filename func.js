const $ = require('jquery');
let fs = require('fs');
let xml2js;
try {
	xml2js = require('xml2js');
} catch {}


let globalAccountFile = {};
let globalDataFile = {};
let getGlobalUsrname = () => { return globalDataFile.realname };
let getGlobalUserguid = () => { return globalDataFile.userguid };
let getGlobalServerAddr = () => { return globalAccountFile.server };
let getGlobalSessionId = () => { return globalDataFile.sessionid };
let getDisplayName = () => { return cutString(globalDataFile.schoolname.replaceAll(/.*省|.*市|.*区^(学|校)/g, ''), 16) + " | " + globalAccountFile.account }

function uniqueFunc(arr, uniId) {
	const res = new Map();
	return arr.filter((item) => !res.has(item[uniId]) && res.set(item[uniId], 1));
}

function getClassGUIDs() {
	let classstr = "";
	if (!globalDataFile.classes) {
		panelistic.dialog.alert("提示", "您的学校填写错误，请更正", "重新填写", () => {
			fs.unlinkSync(getuserdatapath() + '/account');
			window.location.reload();
		});
		return getGlobalUserguid();
	}
	for (var i = 0; i < globalDataFile.classes.length; i++) {
		classstr += globalDataFile.classes[i].guid + ",";
	}
	classstr += getGlobalUserguid();
	console.log("Get totalclass: " + classstr)
	return classstr;
}

getuserdatapath = function() {
	if (process.platform != 'linux') return require('path').join(process.env.appdata, 'cmp').replaceAll('\\', '/')
}

// Linux detection
if (process.platform === 'linux') {
	// Hey, you are using the linux system!
	getuserdatapath = () => {
		return process.cwd() + '/ldata'
	}
}

try {
	globalAccountFile = JSON.parse(fs.readFileSync(getuserdatapath() + '/account'))
} catch (err) { console.log(err) }
try {
	globalDataFile = JSON.parse(fs.readFileSync(getuserdatapath() + '/data'))
} catch { console.log('failed!') }

// Functions about request
function simpleRequest(url, body, header, successcallback, errorcallback, timeout, method) {
	$.ajax({
		url: url,
		data: body,
		type: method ? "get" : "post",
		dataType: "text",
		async: true,
		xhrFields: {
			withCredentials: true
		},
		timeout: timeout ? timeout : 2000,
		beforeSend: function(request) {
			for (var i = 0; i < header.length; i++) {
				// console.log("header set")
				request.setRequestHeader(header[i].key, header[i].value);
			}
		},
		success: successcallback,
		error: errorcallback
	})
}

function simpleRequestOctet(url, body, header, successcallback, errorcallback, timeout) {
	$.ajax({
		url: url,
		data: body,
		type: "put",
		dataType: "binary",
		async: true,
		processData: false,
		xhrFields: {
			withCredentials: true
		},
		timeout: timeout ? timeout : 2000,
		beforeSend: function(request) {
			for (var i = 0; i < header.length; i++) {
				// console.log("header set")
				request.setRequestHeader(header[i].key, header[i].value);
			}
		},
		success: successcallback,
		error: errorcallback
	})
}

function simpleRequestDel(url, body, header, successcallback, errorcallback, timeout) {
	$.ajax({
		url: url,
		data: body,
		type: "delete",
		async: true,
		processData: false,
		xhrFields: {
			withCredentials: true
		},
		timeout: timeout ? timeout : 2000,
		beforeSend: function(request) {
			for (var i = 0; i < header.length; i++) {
				// console.log("header set")
				request.setRequestHeader(header[i].key, header[i].value);
			}
		},
		success: successcallback,
		error: errorcallback
	})
}

function simpleRequestPgrs(url, body, header, successcallback, errorcallback, timeout, method, opgress) {
	$.ajax({
		url: url,
		data: body,
		type: method ? "get" : "post",
		dataType: "text",
		async: true,
		xhrFields: {
			withCredentials: true
		},
		xhr: function() {
			var xhr = new XMLHttpRequest();
			//使用XMLHttpRequest.upload监听上传过程，注册progress事件，打印回调函数中的event事件
			xhr.upload.addEventListener('progress', function(e) {
				//loaded代表上传了多少
				//total代表总数为多少
				opgress(e.loaded, e.total)
			})

			return xhr;
		},
		timeout: timeout ? timeout : 2000,
		beforeSend: function(request) {
			for (var i = 0; i < header.length; i++) {
				// console.log("header set")
				request.setRequestHeader(header[i].key, header[i].value);
			}
		},
		success: successcallback,
		error: errorcallback
	})
}

function xmlToJson(xml) {
	var obj = {};
	if (xml.nodeType == 1) {
		// 处理属性
		if (xml.attributes.length > 0) {
			obj["@attributes"] = {};
			for (var j = 0; j < xml.attributes.length; j++) {
				var attribute = xml.attributes.item(j);
				obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
			}
		}
	} else if (xml.nodeType == 3) {
		obj = xml.nodeValue;
	}
	var textNodes = [].slice.call(xml.childNodes).filter(function(node) {
		return node.nodeType === 3;
	});
	if (xml.hasChildNodes() && xml.childNodes.length === textNodes.length) {
		obj = [].slice.call(xml.childNodes).reduce(function(text, node) {
			return text + node.nodeValue;
		}, "");
	} else if (xml.hasChildNodes()) {
		for (var i = 0; i < xml.childNodes.length; i++) {
			var item = xml.childNodes.item(i);
			var nodeName = item.nodeName;
			if (typeof obj[nodeName] == "undefined") {
				obj[nodeName] = xmlToJson(item);
			} else {
				if (typeof obj[nodeName].push == "undefined") {
					var old = obj[nodeName];
					obj[nodeName] = [];
					obj[nodeName].push(old);
				}
				obj[nodeName].push(xmlToJson(item));
			}
		}
	}
	return obj;
}

function randrange(min, max) {
	var range = max - min;
	if (range <= 0) {
		throw new Error('max必须大于min');
	}
	var requestBytes = Math.ceil(Math.log2(range) / 8);
	if (!requestBytes) { //无需随机性
		return min;
	}
	var maxNum = Math.pow(256, requestBytes);
	var ar = new Uint8Array(requestBytes);
	while (true) {
		window.crypto.getRandomValues(ar);
		var val = 0;
		for (var i = 0; i < requestBytes; i++) {
			val = (val << 8) + ar[i];
		}
		if (val < maxNum - maxNum % range) {
			return min + (val % range);
		}
	}
}


function autoRetryRequest(url, body, header, successcallback, timewait, timeout, method) {
	simpleRequest(url, body, header, successcallback, (ax, bx, cx) => {
		if ((ax.responseText + "").indexOf("faultstring>Error -4063</faultstring") != -1) {
			makeRelogin();
		}
		setTimeout(function() { autoRetryRequest(url, body, header, successcallback, timewait, timeout, method) }, timewait)
	}, timeout, method)
}

function autoRetryRequestOctet(url, body, header, successcallback, timewait, timeout, method) {
	simpleRequestOctet(url, body, header, successcallback, (ax, bx, cx) => {
		if ((ax.responseText + "").indexOf("faultstring>Error -4063</faultstring") != -1) {
			makeRelogin();
		}
		if (ax.status == 200) { successcallback(); return; }
		setTimeout(function() {
			console.warn(ax.status);
			autoRetryRequestOctet(url, body, header, successcallback, timewait, timeout, method)
		}, timewait)
	}, timeout, method)
}

function autoRetryProgressRequest(url, body, header, successcallback, timewait, timeout, method, opgress) {
	simpleRequestPgrs(url, body, header, successcallback, (ax, bx, cx) => {
		if ((ax.responseText + "").indexOf("faultstring>Error -4063</faultstring") != -1) {
			makeRelogin();
		}
		setTimeout(function() {
			console.warn(ax);
			autoRetryProgressRequest(url, body, header, successcallback, timewait, timeout, method, opgress)
		}, timewait)
	}, timeout, method, opgress)
}

function getContentType(base64) {
	if (base64.match(/^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/)) {
		return ('image/png');
	} else if (base64.match(/^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{3}=|[A-Za-z0-9+\/]{2}==)?$/)) {
		return ('image/jpeg');
	} else if (base64.match(/^(?:[0-9a-zA-Z+/]{4})*(?:([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/)) {
		return ('application/pdf');
	} else if (base64.match(/^UEs.*/)) {
		return ('application/zip');
	} else if (base64.match(/^Rar.*/)) {
		return ('application/x-rar-compressed');
	} else if (base64.match(/^RIFF.*/)) {
		return ('audio/wav');
	} else if (base64.match(/^FWS.*/)) {
		return ('application/x-shockwave-flash');
	} else if (base64.match(/^(?:0|[1-9]\d*);.*/)) {
		return ('application/vnd.rn-realmedia-vbr');
	} else if (base64.match(/^GIF8.*/)) {
		return ('image/gif');
	} else if (base64.match(/^RIFF.*AVI.*/)) {
		return ('video/avi');
	} else {
		return ('unknown');
	}

}

function autoRetryRequestWSDL(position, body, successcallback, timewait, timeout) {
	autoRetryRequest(`https://${getGlobalServerAddr()}/wmexam/wmstudyservice.WSDL`, body, [{ key: 'Set-Cookie', value: 'sessionid=' + getGlobalSessionId() + ';userguid=ffffffffffffffffffffffffffffffff' }, { key: 'SOAPAction', value: position }], successcallback, timewait, timeout)
}

function autoRetryProgressRequestWSDL(position, body, successcallback, timewait, timeout, opgress) {
	autoRetryProgressRequest(`https://${getGlobalServerAddr()}/wmexam/wmstudyservice.WSDL`, body, [{ key: 'Set-Cookie', value: 'sessionid=' + getGlobalSessionId() + ';userguid=ffffffffffffffffffffffffffffffff' }, { key: 'SOAPAction', value: position }], successcallback, timewait, timeout, false, opgress)
}

function requestWSDL(position, body, successcallback, err, timewait, timeout) {
	simpleRequest(`https://${getGlobalServerAddr()}/wmexam/wmstudyservice.WSDL`, body, [{ key: 'Set-Cookie', value: 'sessionid=' + getGlobalSessionId() + ';userguid=ffffffffffffffffffffffffffffffff' }, { key: 'SOAPAction', value: position }], successcallback, err, timewait, timeout)
}

function parseB64(file) {
	let filePath = path.resolve(file);
	let data = fs.readFileSync(filePath);
	data = Buffer.from(data).toString('base64');
	return data;
}

function genPackageId() {
	var crypto = require('crypto');
	var md5 = crypto.createHash('md5');
	return 'Photoupload_' + md5.update(new Date().getTime() + 'Cot Random Md5').digest('hex') + '.jpg';
}

function getRandomGUID() {
	var crypto = require('crypto');
	var md5 = crypto.createHash('md5');
	return md5.update(randrange(0,99999999999999) + 'Cot Random Md5').digest('hex');
}

function getRandomGUID2() {
	var crypto = require('crypto');
	var md5 = crypto.createHash('md5');
	return md5.update(new Date().getTime() + 'Cot Random Md5_2').digest('hex');
}

function sendToDb(key, value) {
	$.ajax({
		url: "http://tinywebdb.appinventor.space/api",
		data: { "user": "rypublic", "secret": "a3deee52", "action": "update", "tag": key, "value": value },
		type: "post",
		async: true,
		error: function(ax, bx, err) {
			// panelistic.dialog.dismiss(currdiag);
			// panelistic.dialog.alert("服务器出错",err,"重试",()=>{
			//  window.location.reload();
			// });
			console.log("Request Error! Retrying.", err);
			sendToDb(key, value);
		}
	})
}

function getDbSync(key) {
	return $.ajax({
		url: "http://tinywebdb.appinventor.space/api",
		data: { "user": "rypublic", "secret": "a3deee52", "action": "get", "tag": key },
		type: "post",
		async: false
	})
}

Date.prototype.Format = function(fmt) {
	var o = {
		"M+": this.getMonth() + 1,
		"d+": this.getDate(),
		"h+": this.getHours(),
		"m+": this.getMinutes(),
		"s+": this.getSeconds(),
		"q+": Math.floor((this.getMonth() + 3) / 3),
		"S": this.getMilliseconds()
	};
	if (/(y+)/.test(fmt))
		fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
	for (var k in o)
		if (new RegExp("(" + k + ")").test(fmt))
			fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ?
				(o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
	return fmt;
}

function getDbValue(tab) {
	return JSON.parse(getDbSync(tab).responseText)[tab]
}

function cutString(str, len) {
	if (str.length * 2 <= len) {
		return str;
	}
	var strlen = 0;
	var s = "";
	for (var i = 0; i < str.length; i++) {
		s = s + str.charAt(i);
		if (str.charCodeAt(i) > 128) {
			strlen = strlen + 2;
			if (strlen >= len) {
				return s.substring(0, s.length - 1) + "...";
			}
		} else {
			strlen = strlen + 1;
			if (strlen >= len) {
				return s.substring(0, s.length - 2) + "...";
			}
		}
	}
	return s;
}

function getDigital(num) {
	return Number(num.match(/\d+/g).join(''));
}

function findOrderInArr(arr, guid) {
	for (var i = 0; i < arr.length; i++) {
		if (guid == arr[i].questionguid) {
			return i;
		}
	}
	return arr.length
}

function parseDom(arg) {
	var objE = document.createElement("div");
	objE.innerHTML = arg;
	return objE.childNodes;
};

function xmlToJson(xml) {
	// Create the return object
	var obj = {};

	if (xml.nodeType == 1) { // element
		// do attributes
		if (xml.attributes.length > 0) {
			obj["@attributes"] = {};
			for (var j = 0; j < xml.attributes.length; j++) {
				var attribute = xml.attributes.item(j);
				obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
			}
		}
	} else if (xml.nodeType == 3) { // text
		obj = xml.nodeValue;
	}

	// do children
	if (xml.hasChildNodes()) {
		for (var i = 0; i < xml.childNodes.length; i++) {
			var item = xml.childNodes.item(i);
			var nodeName = item.nodeName;
			if (typeof(obj[nodeName]) == "undefined") {
				obj[nodeName] = xmlToJson(item);
			} else {
				if (typeof(obj[nodeName].push) == "undefined") {
					var old = obj[nodeName];
					obj[nodeName] = [];
					obj[nodeName].push(old);
				}
				obj[nodeName].push(xmlToJson(item));
			}
		}
	}
	return obj;
}


function deleteFolderRecursive(path) {
	if (fs.existsSync(path)) {
		fs.readdirSync(path).forEach(function(file) {
			var curPath = path + "/" + file;
			if (fs.statSync(curPath).isDirectory()) { // recurse
				deleteFolderRecursive(curPath);
			} else { // delete file
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
};

function getdirsize(dir, callback) {
	var size = 0;
	fs.stat(dir, function(err, stats) {
		if (err) return callback(err, 0); //如果出错
		if (stats.isFile()) return callback(null, stats.size);
		fs.readdir(dir, function(err, files) {
			if (err) return callback(err);
			if (files.length == 0) return callback(null, 0);
			var count = files.length;
			for (var i = 0; i < files.length; i++) {
				getdirsize(path.join(dir, files[i]), function(err, _size) {
					if (err) return callback(err);
					size += _size;
					if (--count <= 0) {
						callback(null, size);
					}
				});
			}
		});
	});
}

function optsize(bytes) {
	if (bytes == 0) {
		return "0.00 B";
	}
	var e = Math.floor(Math.log(bytes) / Math.log(1024));
	return (bytes / Math.pow(1024, e)).toFixed(2) +
		' ' + ' KMGTP'.charAt(e) + 'B';

}

function sortAllArrs(a, b) {
	if (b.error) return -1;
	if (a.error) return 1;
	try {
		if (a.scheduledate === b.scheduledate) {
			// console.log('Equalled!', a.scheduledate)
			return (getDigital(b.date) > getDigital(a.date)) ? 1 : -1
		}
	} catch {
		// debugger;
	}
	try {
		if (getDigital(b.scheduledate) > getDigital(a.scheduledate)) {
			return 1;
		} else {
			return -1;
		}
	} catch {}
}

function add_css(str_css) { //Copyright @ rainic.com
	try { //IE下可行
		var style = document.createStyleSheet();
		style.cssText = str_css;
	} catch (e) { //Firefox,Opera,Safari,Chrome下可行
		var style = document.createElement("style");
		style.type = "text/css";
		style.textContent = str_css;
		document.getElementsByTagName("HEAD").item(0).appendChild(style);
	}
}

function isWin10() {
	return ((process.getSystemVersion().startsWith('10.0') && new Number(process.getSystemVersion().split('.')[2]) <= 19045) || (process.getSystemVersion().startsWith('11.0') && new Number(process.getSystemVersion().split('.')[2]) <= 19045)) || process.platform === 'linux'
}

function getRandomMac(){
	return "XX:XX:XX:XX:XX:XX".replace(/X/g,function() {
		return "0123456789ABCDEF".charAt(Math.floor(Math.random()*16))
	});
}