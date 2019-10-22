const WebSocket = require('ws');
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid/v1');

// 账号密码
global.secret = JSON.parse(fs.readFileSync('./secret.json', 'utf8'));

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
    console.log('content:', recvObj.params.content);

    // 被at了
    if (protocols.atme(recvObj)) {
        // 协议入口
        if (!protocols.SauceNAO(recvObj, client) &&
            !protocols.UnityDoc(recvObj, client)) {
            protocols.TunlingBot(recvObj, client);
        }
    }

    // 复读机
    protocols.repeater(recvObj, client);
});

client.on('pong', () => {
    // console.log('pong!');
});

client.on('close', (code, reason) => {
    console.log('closed:', code, reason);
});