/*version: panelistic 3.0 for Electron apps*/
/*author: cotzhang@github*/

let panelistic_blur;
let panelistic_dialog_count = 0;
let panelistic_callback = {"name":"callback"};
function Panelistic() {
	this.dialog = {};
	this.dialog.alert= function(title,content,button,callback) {
		let id = Date.now();
		panelistic_callback["v"+id] = callback?callback:()=>{};
		panelistic_blur.innerHTML += `<div class="panelistic_popup" id="${id}"><div class="panelistic_panel panelistic_popup_layout"><span class="panelistic_popup_title">${title}</span><br><span class="panelistic_placeholder"></span><span class="panelistic_popup_content">${content}</span></div><span class="panelistic_placeholder"></span><input type="button" value="${button}" onclick="panelistic.dialog.dismiss(${id});panelistic_callback.v${id}();"><br></div>`
		panelistic_blur.style.visibility='visible';
		panelistic_dialog_count++;
		return id;
	}
	this.dialog.salert= function(content) {
		let id = Date.now();
		panelistic_blur.innerHTML += `<div class="panelistic_popup" id="${id}"><div class="panelistic_panel panelistic_popup_layout"><spa<span class="panelistic_popup_content">${content}</span></div><span class="panelistic_placeholder"></span><span class="panelistic_placeholder"></span><input type="button" value="Dismiss" onclick="panelistic.dialog.dismiss(${id});"><br></div>`
		panelistic_blur.style.visibility='visible';
		panelistic_dialog_count++;
		return id;
	}
	this.dialog.input= function(title,content,placeholder,button,callback) {
		let id = Date.now();
		panelistic_callback["v"+id] = callback?callback:()=>{};
		panelistic_blur.innerHTML += `<div class="panelistic_popup" id="${id}"><div class="panelistic_panel panelistic_popup_layout"><span class="panelistic_popup_title">${title}</span><br><span class="panelistic_placeholder"></span><span class="panelistic_popup_content">${content}</span></div><span class="panelistic_placeholder"></span><input type="text" placeholder=${placeholder} value="" id="input${id}" class="panelistic_dialog_input"><span class="panelistic_placeholder"></span><input type="button" value="${button}" onclick="panelistic_callback.v${id}(document.getElementById('input${id}').value);panelistic.dialog.dismiss(${id});"><br></div>`
		panelistic_blur.style.visibility='visible';
		panelistic_dialog_count++;
		return id;
	}
	this.dialog.confirm= function(title,content,btntrue,btnfalse,callback) {
		let id = Date.now();
		panelistic_callback["v"+id] = callback?callback:()=>{};
		panelistic_blur.innerHTML += `<div class="panelistic_popup" id="${id}"><div class="panelistic_panel panelistic_popup_layout"><span class="panelistic_popup_title">${title}</span><br><span class="panelistic_placeholder"></span><span class="panelistic_popup_content">${content}</span></div><span class="panelistic_placeholder"></span><input type="button" value="${btntrue}" onclick="panelistic.dialog.dismiss(${id});panelistic_callback.v${id}(1);">&nbsp;<input type="button" value="${btnfalse}" onclick="panelistic.dialog.dismiss(${id});panelistic_callback.v${id}(0);"><br></div>`
		panelistic_blur.style.visibility='visible';
		panelistic_dialog_count++;
		return id;
	}
	this.dialog.dismiss = function(id) {
		if (panelistic_dialog_count>0) {
			panelistic_dialog_count--;
			document.getElementById(id+"").remove();
			if(panelistic_dialog_count==0){
				panelistic_blur.style.visibility='hidden';
			}
		}
		else{
			return false;
		}
	}
	this.initialize = function() {
		panelistic_blur = document.getElementById('panelistic_blur');
	}
}