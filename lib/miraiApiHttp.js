const request = require('request');
const recvType = require('./receiveType');
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const e = require('express');

function requestAsync(method, _path, json) {
    return new Promise((resolve, reject) => {
        request(`http://${secret.MiraiApiHttpHost}:${secret.MiraiApiHttpPort}${_path}`, {
            method,
            json: json || true
        }, (err, res, body) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(body);
        });
    });
}

function postFormAsync(_path, formData) {
    return new Promise((resolve, reject) => {
        request.post(`http://${secret.MiraiApiHttpHost}:${secret.MiraiApiHttpPort}${_path}`, {
            formData,
            json: true
        }, (err, res, body) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(body);
        });
    });
}

module.exports = {
    async about() {
        const res = await requestAsync('GET', '/about');
        return res.data;
    },
    async auth() {
        const res = await requestAsync('POST', '/auth', {
            authKey: secret.MiraiApiHttpAuthKey
        });
        if (res.code != 0) throw res;
        return res.session;
    },
    async verify(sessionKey) {
        const res = await requestAsync('POST', '/verify', {
            sessionKey,
            qq: secret.targetQQ
        });
        if (res.code != 0) throw res;
    },
    async release(sessionKey) {
        await requestAsync('POST', '/release', {
            sessionKey,
            qq: secret.targetQQ
        });
    },
    async uploadImage(sessionKey, type, filePath) {
        let res;
        switch (type) {
            case recvType.FriendMessage:
                res = await postFormAsync('/uploadImage', {
                    sessionKey,
                    type: 'friend',
                    img: fs.createReadStream(filePath)
                });
                break;
            case recvType.GroupMessage:
                res = await postFormAsync('/uploadImage', {
                    sessionKey,
                    type: 'group',
                    img: fs.createReadStream(filePath)
                });
                break;
            case recvType.TempMessage:
                res = await postFormAsync('/uploadImage', {
                    sessionKey,
                    type: 'temp',
                    img: fs.createReadStream(filePath)
                });
                break;
        }
        return res;
    },
    async uploadVoice(sessionKey, type, filePath) {
        // https://github.com/project-mirai/mirai-api-http/blob/master/docs/API.md#%E8%AF%AD%E9%9F%B3%E6%96%87%E4%BB%B6%E4%B8%8A%E4%BC%A0
        // 当前仅支持 "group"
        let res;
        switch (type) {
            case recvType.FriendMessage:
                break;
            case recvType.GroupMessage:
                res = await postFormAsync('/uploadVoice', {
                    sessionKey,
                    type: 'group',
                    voice: fs.createReadStream(filePath)
                });
                break;
            case recvType.TempMessage:
                break;
        }
        return res;
    },
    async send(sessionKey, recvObj, message) {
        // 处理At，上传图片与语音
        for (let i = message.length - 1; i >= 0; i--) {
            switch (message[i].type) {
                case 'Image':
                    if (message[i].url) {
                        // 如果是网络图片先下载
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
                            if (recvObj.type != recvType.GroupMessage) {
                                // 私聊图裂的临时解决方案
                                await this.uploadImage(sessionKey, recvType.GroupMessage, savedImagePath)
                            }
                            const res = await this.uploadImage(sessionKey, recvObj.type, savedImagePath);
                            if (res) {
                                delete message[i].url
                                message[i].imageId = res.imageId;
                            } else {
                                message.splice(i, 1);
                            }
                        } else {
                            message.splice(i, 1);
                        }
                    } else if (message[i].path) {
                        if (recvObj.type != recvType.GroupMessage) {
                            // 私聊图裂的临时解决方案
                            await this.uploadImage(sessionKey, recvType.GroupMessage, message[i].path)
                        }
                        const res = await this.uploadImage(sessionKey, recvObj.type, message[i].path);
                        if (res) {
                            delete message[i].path
                            message[i].imageId = res.imageId;
                        } else {
                            message.splice(i, 1);
                        }
                    }
                    break;
                case 'Voice':
                    if (message[i].url) {
                        // 未实现
                        message.splice(i, 1);
                    } else if (message[i].path) {
                        const res = await this.uploadVoice(sessionKey, recvObj.type, message[i].path);
                        if (res) {
                            delete message[i].path
                            message[i].voiceId = res.voiceId;
                        } else {
                            message.splice(i, 1);
                        }
                    }
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
                requestAsync('POST', '/sendFriendMessage', {
                    sessionKey,
                    target: recvObj.qq,
                    messageChain: message
                });
                break;
            case recvType.GroupMessage:
                requestAsync('POST', '/sendGroupMessage', {
                    sessionKey,
                    target: recvObj.group,
                    messageChain: message
                });
                break;
            case recvType.TempMessage:
                requestAsync('POST', '/sendTempMessage', {
                    sessionKey,
                    qq: recvObj.qq,
                    group: recvObj.group,
                    messageChain: message
                });
                break;
        }
    }
}