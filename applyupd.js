function APPLYUPD(upditems) {
	var zip = new AdmZip(getuserdatapath() + '/app.zip')
	zip.getEntries()
	zip.extractAllTo(process.cwd(), true)
	panelistic.dialog.confirm("更新", "软件更新完成，是否立即应用更新？应用更新将重启软件。<br><br>" + upditems, "应用更新", "取消", (cf) => {
		if (cf) {
			remote.app.relaunch()
			remote.app.exit()
		}
	})
}