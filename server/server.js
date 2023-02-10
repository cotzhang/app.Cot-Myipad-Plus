const http = require('http');
const endstr = `</span>
        </div>
    </div>
</body>

</html>`
if (process.platform != 'linux') {
http.createServer((req, res) => {
    console.log('requesting: ' + req.url)
    if (req.url == '/') {
        fs.readFile(__dirname + '/server/server.html', (err, data) => {
            res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
            if (err) {
                console.error(err)
            }
            res.write(data);
            res.write('您的姓名: '+getGlobalUsrname()+'<br>您的学校: '+cutString(globalDataFile.schoolname.replaceAll(/.*省|.*市|.*区^(学|校)/g, ''), 16)+'<br>服务器状态: 已连接<br>服务器地址: '+require('ip').address())
            res.end(endstr)
        })
    } else {
        fs.readFile(__dirname + req.url, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/html;charset=utf-8' });
                res.end('平板+ 资源服务器访问错误：\n您请求的资源不存在。');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
                res.end(data);
            }
        });
    }
}).listen(307);
}