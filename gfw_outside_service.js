const express = require('express');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

// 账号密码
global.secret = JSON.parse(fs.readFileSync('./secret.json', 'utf8'));

const app = express();
const port = 33100;

app.use(express.json());

// 创建图片文件夹
if (!fs.existsSync(secret.imagePath)) {
    fs.mkdirSync(secret.imagePath);
}
app.use('/image/', express.static(secret.imagePath));

cleanUp();
// 计时器 每秒执行一次
// 当前小时
let curHours = moment().hours();
const timer = setInterval(() => {
    const curMoment = moment();
    if (curHours != curMoment.hours()) {
        curHours = curMoment.hours();
        //清理色图缓存
        cleanUp();
    }
}, 1000);

function cleanUp() {
    const imgDir = fs.readdirSync(secret.imagePath);
    for (const imgPath of imgDir) {
        fs.unlinkSync(path.join(secret.imagePath, imgPath));
    }
}

// 载入所有墙外服务
for (const serviceName of fs.readdirSync('./services')) {
    if (fs.statSync(`./services/${serviceName}`).isFile() && serviceName.endsWith('.js')) {
        app.post(`/service/${path.basename(serviceName,'.js')}`, require(`./services/${serviceName}`));
    }
}

app.listen(port, secret.httpHost);