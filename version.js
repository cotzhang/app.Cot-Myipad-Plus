let fs = require('fs');
const json = fs.readFileSync(__dirname + "/package.json", "utf-8");
const pkg = JSON.parse(json);
const readline = require('readline').createInterface({
	input: process.stdin,
	output: process.stdout
})
let oldver = new Number(fs.readFileSync(__dirname + "/cmpVerInfo.txt"))
console.log("Oldver: " + oldver)
console.log("Newver: " + (oldver + 1))
fs.writeFileSync(__dirname + "/cmpVerInfo.txt",(oldver+1)+"")
fs.writeFileSync(__dirname + "/versionBUILD",(oldver+1)+"")
console.log("Old version name: " + pkg.version)
readline.question(`Please input new version name: `, name => {
	pkg.version = name;
	console.log(`Version changed: ${name}!`)
	fs.writeFileSync(__dirname + "/package.json", JSON.stringify(pkg));
	readline.close()
})