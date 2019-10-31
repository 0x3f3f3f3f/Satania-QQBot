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
    if (!fs.existsSync(secret.chromiumUserData))
        fs.mkdirSync(secret.chromiumUserData, {
            recursive: true
        });
    global.browser = await puppeteer.launch({
        userDataDir: secret.chromiumUserData,
        //headless模式加载缓慢的解决办法 https://github.com/GoogleChrome/puppeteer/issues/1718
        args: [
            '--proxy-server="direct://"',
            '--proxy-bypass-list=*'
        ]
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

function connet(host, port) {
    if (client) {
        client.off('open', onOpen);
        client.off('message', onMessage);
        client.off('pong', onPong);
        client.off('close', onClose);
        client.off('error', onError);
    }
    client = new WebSocket(`ws://${secret.wsHost}:${secret.wsPort}/`);
    client.on('open', onOpen);
    client.on('message', onMessage);
    client.on('pong', onPong);
    client.on('close', onClose);
    client.on('error', onError);
}

let client;
connet();

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

// 协议入口
function protocolEntry(recvObj, client) {
    if (!protocols.SauceNAO(recvObj, client) &&
        !protocols.TraceMoe(recvObj, client) &&
        !protocols.UnityDoc(recvObj, client) &&
        !protocols.PixivPic(recvObj, client)) {
        protocols.AIQQBot(recvObj, client);
    }
}

function onOpen() {
    console.log('opend!');
}

// ws消息送达
function onMessage(data) {
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
    for (const pending of TraceMoePendingList) {
        if (recvObj.params.group == pending.recvObj.params.group &&
            recvObj.params.qq == pending.recvObj.params.qq) {
            protocols.TraceMoe(recvObj, client, true);
            return;
        }
    }

    if (recvObj.params.type == 1 ||
        recvObj.params.type == 3 ||
        recvObj.params.type == 5 ||
        recvObj.params.type == 6) {
        protocolEntry(recvObj, client);
    }
    // 在群里需要先被at了
    else if (protocols.atme(recvObj)) {
        protocolEntry(recvObj, client);
    } else {
        // 复读机
        protocols.repeater(recvObj, client);
    }
}

function onPong() {
    // console.log('pong!');
}

function onClose(code, reason) {
    console.log('closed:', code, reason);
}

function onError(error) {
    console.error('error:', error);
}

// 分步事件
const SauceNaoPendingList = [];
const TraceMoePendingList = [];
appEvent.on('SauceNao_pending', recvObj => {
    SauceNaoPendingList.push({
        recvObj,
        time: 60
    });
});
appEvent.on('TraceMoe_pending', recvObj => {
    TraceMoePendingList.push({
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
appEvent.on('TraceMoe_done', recvObj => {
    for (let i = 0; i < TraceMoePendingList.length; i++) {
        const pending = TraceMoePendingList[i];
        if (recvObj.params.group == pending.recvObj.params.group &&
            recvObj.params.qq == pending.recvObj.params.qq) {
            TraceMoePendingList.splice(i, 1);
            break;
        }
    }
});

const pendingTimer = setInterval(() => {
    for (let i = SauceNaoPendingList.length - 1; i >= 0; i--) {
        const pending = SauceNaoPendingList[i];
        pending.time--;
        if (pending.time == 0) {
            SauceNaoPendingList.splice(i, 1);
        }
    }
    for (let i = TraceMoePendingList.length - 1; i >= 0; i--) {
        const pending = TraceMoePendingList[i];
        pending.time--;
        if (pending.time == 0) {
            TraceMoePendingList.splice(i, 1);
        }
    }
}, 1000);

const reconnectTimer = setInterval(() => {
    // 断线重连
    if (client.readyState == WebSocket.CLOSED) {
        console.log('reconnect...');
        connet();
    }
}, 1000);