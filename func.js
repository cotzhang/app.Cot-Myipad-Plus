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