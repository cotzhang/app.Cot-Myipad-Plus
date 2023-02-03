const { app } = require('electron')

getuserdatapath = () => {
  return require('path').join(process.env.appdata,'cmp').replaceAll('\\','/')
}

// Linux detection
if (process.platform === 'linux') {
  // Hey, you are using the linux system!
  getuserdatapath = () => {
    return process.cwd() + '/ldata'
  }
}