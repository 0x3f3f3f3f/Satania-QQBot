const childProcess = require('child_process');
const path = require('path');
const _ = require('lodash');

const dgram = require('dgram');

module.exports = function (recvObj, client) {
    if (/(运行|执行|跑)c#|c#(运行|执行)/ig.test(recvObj.content)) {
        const code = recvObj.content.replace(/\[.*?\]|运行|执行|跑|c#/ig, '').replace(/(\\r\\n|\\n)/g, '\n');

        const udpClient = dgram.createSocket('udp4');

        udpClient.on('error', (err) => {
            console.error(err.message);
            console.error(err.stack);
            client.sendMsg(recvObj, '欧尼酱执行出错了~喵');
            udpClient.close();
        });
        // 发送代码
        udpClient.send(code, secret.evaluateCodePort, secret.evaluateCodeHost);

        udpClient.on('message', (msg, rinfo) => {
            client.sendMsg(recvObj, `[QQ:at=${recvObj.qq}]\r\n` + msg.toString());
        });

        return true;
    }
    return false;
}