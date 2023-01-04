const { app } = require('electron')

getuserdatapath = () => {
  return require('path').join(process.env.appdata,'cmp').replaceAll('\\','/')
}