const request = require('request');
const recvType = require('./receiveType');
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid').v4;

let client;
const syncList = {}

async function _send(syncId, command, content = {}) {
    if (!client) return;
    client.send(JSON.stringify({
        syncId,
        command,
        subCommand: null,
        content
    }));
    const res = await Promise.race([
        new Promise(resolve => {
            syncList[syncId] = resolve;
        }),
        new Promise(resolve => {
            setTimeout(resolve, 30000, null);
        })
    ]);
    delete syncList[syncId];
    return res;
}

module.exports = {
    get client() {
        return client;
    },
    set client(value) {
        client = value;
    },
    get syncList() {
        return syncList;
    },
    async about() {
        const res = await _send(uuid(), 'about');
        return res.data;
    },
    async send(recvObj, message) {
        // 处理At，上传图片与语音
        for (let i = message.length - 1; i >= 0; i--) {
            switch (message[i].type) {
                case 'Image':
                    // 如果是网络图片先下载
                    if (message[i].url) {
                        const savedImagePath = await new Promise(resolve => {
                            request.get(message[i].url, {
                                encoding: null
                            }, (err, res, body) => {
                                let imagePath;
                                if (!err && _.isBuffer(body)) {
                                    imagePath = path.join(secret.tempPath, 'image', path.basename(message[i].url));
                                    fs.writeFileSync(imagePath, body);
                                }
                                resolve(imagePath);
                            });
                        });
                        if (savedImagePath) {
                            delete message[i].url
                            message[i].path = savedImagePath;
                        } else {
                            message.splice(i, 1);
                        }
                    }
                    break;
                case 'Voice':
                    // 未实现
                    message.splice(i, 1);
                    break;
                case 'At':
                    if (recvObj.type != recvType.GroupMessage) {
                        message.splice(i, 1);
                    }
                    break;
            }
        }
        switch (recvObj.type) {
            case recvType.FriendMessage:
                _send(uuid(), 'sendFriendMessage', {
                    target: recvObj.qq,
                    messageChain: message
                });
                break;
            case recvType.GroupMessage:
                _send(uuid(), 'sendGroupMessage', {
                    target: recvObj.group,
                    messageChain: message
                });
                break;
            case recvType.TempMessage:
                _send(uuid(), 'sendTempMessage', {
                    qq: recvObj.qq,
                    group: recvObj.group,
                    messageChain: message
                });
                break;
        }
    }
}