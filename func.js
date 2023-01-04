const $ = require('jquery');
let fs = require('fs');

let globalAccountFile = {};
let globalDataFile = {};
let getGlobalUsrname = () => { return globalDataFile.realname };
let getGlobalUserguid = () => { return globalDataFile.userguid };
let getGlobalServerAddr = () => { return globalAccountFile.server };
let getGlobalSessionId = () => { return globalDataFile.sessionid };
let getDisplayName = () => { return cutString(globalDataFile.schoolname.replaceAll(/.*省|.*市|.*区^(学|校)/g, ''), 16) + " | " + globalAccountFile.account }

function uniqueFunc(arr, uniId){
  const res = new Map();
  return arr.filter((item) => !res.has(item[uniId]) && res.set(item[uniId], 1));
}

getuserdatapath = function() {
	return require('path').join(process.env.appdata, 'cmp').replaceAll('\\', '/')
}

try {
	globalAccountFile = JSON.parse(fs.readFileSync(getuserdatapath() + '/account'))
} catch(err) {console.log(err)}
try {
	globalDataFile = JSON.parse(fs.readFileSync(getuserdatapath() + '/data'))
} catch {console.log('failed!')}

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

function autoRetryRequest(url, body, header, successcallback, timewait, timeout, method) {
	simpleRequest(url, body, header, successcallback, (ax, bx, cx) => {
		if ((ax.responseText + "").indexOf("faultstring>Error -4063</faultstring") != -1) {
			makeRelogin();
		}
		setTimeout(function() { autoRetryRequest(url, body, header, successcallback, timewait, timeout, method) }, timewait)
	}, timeout, method)
}

function autoRetryRequestWSDL(position, body, successcallback, timewait, timeout) {
	autoRetryRequest(`https://${getGlobalServerAddr()}/wmexam/wmstudyservice.WSDL`, body, [{ key: 'Set-Cookie', value: 'sessionid=' + getGlobalSessionId() + ';userguid=ffffffffffffffffffffffffffffffff' }, { key: 'SOAPAction', value: position }], successcallback, timewait, timeout)
}

function requestWSDL(position, body, successcallback, err, timewait, timeout) {
	simpleRequest(`https://${getGlobalServerAddr()}/wmexam/wmstudyservice.WSDL`, body, [{ key: 'Set-Cookie', value: 'sessionid=' + getGlobalSessionId() + ';userguid=ffffffffffffffffffffffffffffffff' }, { key: 'SOAPAction', value: position }], successcallback, err, timewait, timeout)
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