function APPLYUPD(upditems,alertid) {
	var zip = new AdmZip(getuserdatapath() + '/app.zip')
	zip.getEntries()
	zip.extractAllTo(process.cwd(), true)
	panelistic.dialog.confirm("更新", "软件更新完成，需要重启软件以应用更新<br><br>" + upditems, "应用更新", "取消", (cf) => {
		if (cf) {
			remote.app.relaunch()
			remote.app.exit()
		}
	})
}