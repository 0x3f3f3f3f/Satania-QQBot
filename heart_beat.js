const WebSocket = require('ws');
const uuid = require('uuid/v4');
const fs = require('fs');

const secret = JSON.parse(fs.readFileSync('./secret.json', 'utf8'));

function connet() {
    if (client) {
        client.off('open', onOpen);
        client.off('message', onMessage);
        client.off('pong', onPong);
        client.off('close', onClose);
        client.off('error', onError);
    }
    client = new WebSocket(`ws://${secret.wsHost}:${secret.wsPort+1}${secret.wsPath}`);
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
    if (client.readyState == WebSocket.OPEN) {
        client.send(JSON.stringify({
            id: uuid(),
            method: 'sendMessage',
            params: {
                type: 1,
                group: '',
                qq: secret.targetQQ,
                content: 'hb'
            }
        }));
    }
}, 5000);


function onOpen() {
    console.log('opened!');
}

function onMessage(data) {}

function onPong() {
    // console.log('pong!');
}

function onClose(code, reason) {
    console.log('closed:', code, reason);
}

function onError(error) {
    console.error('error:', error);
}

const reconnectTimer = setInterval(() => {
    // 断线重连
    if (client.readyState == WebSocket.CLOSED) {
        console.log('reconnect...');
        connet();
    }
}, 1000);