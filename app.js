const WebSocket = require('ws');
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const EventEmitter = require('events');

// 账号密码
global.secret = JSON.parse(fs.readFileSync('./secret.json', 'utf8'));
// 全局事件
global.appEvent = new EventEmitter();

// 启动浏览器
(async function () {
    if (!fs.existsSync('./chromium/userData'))
        fs.mkdirSync('./chromium/userData');
    global.browser = await puppeteer.launch({
        userDataDir: './chromium/userData'
    });
    appEvent.emit('browser_initialized');
    // 让最开始打开的页面始终在前面
    browser.on('targetcreated', async () => {
        const pages = await browser.pages();
        if (pages[1]) await pages[1].bringToFront();
    });
})();

// 扩展一下ws的send方法
WebSocket.prototype.sendObj = function (obj) {
    this.send(JSON.stringify(obj));
}

const client = new WebSocket(`ws://${secret.wsHost}:${secret.wsPort}/`);

client.on('open', () => {
    console.log('opend!');
});

// 心跳
const heartBeat = setInterval(() => {
    if (client.readyState == WebSocket.OPEN)
        client.ping();
}, 10000);

// 载入所有协议
global.protocols = {};
for (const protocolName of fs.readdirSync('./protocols')) {
    if (fs.statSync(`./protocols/${protocolName}`).isFile && protocolName.endsWith('.js')) {
        protocols[path.basename(protocolName, path.extname(protocolName))] = require(`./protocols/${protocolName}`);
    }
}

// ws消息送达
client.on('message', data => {
    if (!_.isString(data)) return;
    // console.log('=>', data);

    let recvObj;
    try {
        recvObj = JSON.parse(data);
    } catch {}
    if (_.isEmpty(recvObj)) return;

    // 判断是否为qq消息
    if (recvObj.event != 'message') {
        console.log('=>', recvObj);
        return;
    }

    // 打印消息内容
    console.log('群:', recvObj.params.group, 'qq:', recvObj.params.qq, recvObj.params.content);

    // 分步搜图
    for (const pending of SauceNaoPendingList) {
        if (recvObj.params.group == pending.recvObj.params.group &&
            recvObj.params.qq == pending.recvObj.params.qq) {
            protocols.SauceNAO(recvObj, client, true);
            return;
        }
    }

    // 被at了
    if (protocols.atme(recvObj)) {
        // 协议入口
        if (!protocols.SauceNAO(recvObj, client) &&
            !protocols.UnityDoc(recvObj, client) &&
            !protocols.PixivPic(recvObj, client)) {
            protocols.AIQQBot(recvObj, client);
        }
    } else {
        // 复读机
        protocols.repeater(recvObj, client);
    }
});

client.on('pong', () => {
    // console.log('pong!');
});

client.on('close', (code, reason) => {
    console.log('closed:', code, reason);
});

// 分步搜图事件
const SauceNaoPendingList = [];
appEvent.on('SauceNao_pending', recvObj => {
    SauceNaoPendingList.push({
        recvObj,
        time: 60
    });
});
appEvent.on('SauceNao_done', recvObj => {
    for (let i = 0; i < SauceNaoPendingList.length; i++) {
        const pending = SauceNaoPendingList[i];
        if (recvObj.params.group == pending.recvObj.params.group &&
            recvObj.params.qq == pending.recvObj.params.qq) {
            SauceNaoPendingList.splice(i, 1);
            break;
        }
    }
});

const SauceNaoTimer = setInterval(() => {
    for (let i = SauceNaoPendingList.length - 1; i >= 0; i--) {
        const pending = SauceNaoPendingList[i];
        pending.time--;
        if (pending.time == 0) {
            SauceNaoPendingList.splice(i, 1);
        }
    }
}, 1000);