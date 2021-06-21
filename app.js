// 机器人主入口
// 2020.11更换宿主mirai，采用mirai-api-http
// 2021.06 mirai-api-http api升级到纯ws

const WebSocket = require('ws');
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const {
    EventEmitter
} = require('events');
const recvType = require('./libs/receiveType');
const miraiApiHttp = require('./libs/miraiApiHttp');
const messageHelper = require('./libs/messageHelper');

// 账号密码
global.secret = JSON.parse(fs.readFileSync('./secret.json', 'utf8'));
// 全局事件
global.appEvent = new EventEmitter();

// 注册一下send方法
global.sendMsg = (recvObj, message) => miraiApiHttp.send(recvObj, message);
global.sendText = (recvObj, text) => miraiApiHttp.send(recvObj, [{
    type: 'Plain',
    text
}]);
global.sendImage = (recvObj, filePath) => miraiApiHttp.send(recvObj, [{
    type: 'Image',
    path: filePath
}]);
global.sendImageUrl = (recvObj, url) => miraiApiHttp.send(recvObj, [{
    type: 'Image',
    url
}]);
global.sendVoice = (recvObj, filePath) => miraiApiHttp.send(recvObj, [{
    type: 'Voice',
    path: filePath
}]);

// 连接mirai-api-http
async function connect() {
    // 开始连接ws
    if (miraiApiHttp.client) {
        miraiApiHttp.client.off('open', onOpen);
        miraiApiHttp.client.off('message', onMessage);
        miraiApiHttp.client.off('pong', onPong);
        miraiApiHttp.client.off('close', onClose);
        miraiApiHttp.client.off('error', onError);
    }
    miraiApiHttp.client = new WebSocket(`ws://${secret.MiraiApiHttpHost}:${secret.MiraiApiHttpPort}/all?verifyKey=${secret.MiraiApiHttpAuthKey}&qq=${secret.targetQQ}`);
    miraiApiHttp.client.on('open', onOpen);
    miraiApiHttp.client.on('message', onMessage);
    miraiApiHttp.client.on('pong', onPong);
    miraiApiHttp.client.on('close', onClose);
    miraiApiHttp.client.on('error', onError);
}

// 延迟启动，默认10秒，也可以手动
let delayTime = 10;
if (!_.isUndefined(process.argv[2])) {
    const time = parseInt(process.argv[2]);
    if (_.isInteger(time)) delayTime = time;
}
if (delayTime > 0) {
    setTimeout(connect, delayTime * 1000);
} else {
    connect();
}

// 心跳
const heartBeat = setInterval(() => {
    if (miraiApiHttp.client && miraiApiHttp.client.readyState == WebSocket.OPEN) {
        miraiApiHttp.client.ping();
    }
}, 10000);

// 载入所有协议
global.protocols = {};
for (const protocolName of fs.readdirSync('./protocols')) {
    if (fs.statSync(`./protocols/${protocolName}`).isFile() && protocolName.endsWith('.js')) {
        protocols[path.basename(protocolName, path.extname(protocolName))] = require(`./protocols/${protocolName}`);
    }
}
// web服务
require('./Pixiv_web_api')();

// 协议入口
async function protocolEntry(recvObj) {
    if (!protocols.EvaluateCode(recvObj) &&
        !protocols.Dice(recvObj) &&
        !await protocols.SauceNAO(recvObj) &&
        !await protocols.TraceMoe(recvObj) &&
        !protocols.UnityDoc(recvObj) &&
        !await protocols.PixivPic(recvObj)) {
        protocols.AIQQBot(recvObj);
    }
}

async function onOpen() {
    console.log('opened!');
    // 获得版本号
    console.log('mirai-api-http version:', (await miraiApiHttp.about()).version);
}

// ws消息送达
async function onMessage(data) {
    if (!_.isString(data)) return;
    // console.log('=>', data);

    let recvObj;
    try {
        recvObj = JSON.parse(data);
        if (miraiApiHttp.syncList[recvObj.syncId]) {
            // 同步消息回调
            miraiApiHttp.syncList[recvObj.syncId](recvObj.data);
            return;
        } else if (recvObj.syncId == '') {
            // 握手信息
            return;
        } else {
            recvObj = recvObj.data;
        }
    } catch {}
    if (_.isEmpty(recvObj)) return;

    // 判断是否为qq消息
    if (!(recvObj.type == 'FriendMessage' ||
            recvObj.type == 'GroupMessage' ||
            recvObj.type == 'TempMessage')) {
        console.log('=>', recvObj);
        return;
    }

    // 重新定义为通用消息对象
    recvObj = {
        type: recvType.convert(recvObj.type),
        qq: recvObj.sender.id || 0,
        group: (recvObj.sender.group && recvObj.sender.group.id) || 0,
        message: recvObj.messageChain || ''
    }

    // 打印消息内容
    console.log('群:', recvObj.group, 'qq:', recvObj.qq, messageHelper.flat(recvObj.message));

    // 系统消息
    if (recvObj.qq == '10000') return;

    // 反哔哩哔哩小程序
    if (protocols.AntiBiliMiniApp(recvObj)) return;

    // 分步搜图
    for (const pending of SauceNaoPendingList) {
        if (recvObj.group == pending.recvObj.group &&
            recvObj.qq == pending.recvObj.qq) {
            protocols.SauceNAO(recvObj, true);
            return;
        }
    }
    for (const pending of TraceMoePendingList) {
        if (recvObj.group == pending.recvObj.group &&
            recvObj.qq == pending.recvObj.qq) {
            protocols.TraceMoe(recvObj, true);
            return;
        }
    }

    if (recvObj.type != recvType.GroupMessage) {
        await protocolEntry(recvObj);
    }
    // 在群里需要先被at了
    else if (protocols.atme(recvObj)) {
        await protocolEntry(recvObj);
    } else {
        // 复读机
        protocols.repeater(recvObj);
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
        if (recvObj.group == pending.recvObj.group &&
            recvObj.qq == pending.recvObj.qq) {
            SauceNaoPendingList.splice(i, 1);
            break;
        }
    }
});
appEvent.on('TraceMoe_done', recvObj => {
    for (let i = 0; i < TraceMoePendingList.length; i++) {
        const pending = TraceMoePendingList[i];
        if (recvObj.group == pending.recvObj.group &&
            recvObj.qq == pending.recvObj.qq) {
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
    if (miraiApiHttp.client && miraiApiHttp.client.readyState == WebSocket.CLOSED) {
        console.log('reconnect...');
        connect();
    }
}, 1000);