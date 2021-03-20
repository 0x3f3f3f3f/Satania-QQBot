const request = require('request');
const _ = require('lodash');
const uuid = require('uuid').v4;
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const messageHelper = require('../libs/messageHelper');

const localRules = JSON.parse(fs.readFileSync('./protocols/AIQQBot_local_rules.json', 'utf8'));

// const AipSpeechClient = require('baidu-aip-sdk').speech;
// const speechClient = new AipSpeechClient(secret.Baidu_APP_ID, secret.Baidu_API_KEY, secret.Baidu_SECRET_KEY);

module.exports = function (recvObj) {
    const inputText = messageHelper.getText(recvObj.message).trim();
    if (_.isEmpty(inputText)) {
        if (Math.random() > 0.5) {
            // sendTTS(recvObj, '藕妮酱~想我了吗？');
            sendText(recvObj, '藕妮酱~想我了吗？');
        } else {
            sendImage(recvObj, `${secret.emoticonsPath}${path.sep}satania_cry.gif`);
        }
        return;
    }

    // 拦截规则
    for (let i = localRules.length - 1; i >= 0; i--) {
        if (new RegExp(localRules[i].regExp, 'im').test(inputText)) {
            const index = parseInt(Math.random() * localRules[i].msgList.length);
            let msg = localRules[i].msgList[index];
            msg = msg.replace('emoticons', secret.emoticonsPath);
            msg = msg.replace(/\//g, path.sep);
            if (/^image\:/.test(msg)) {
                sendImage(recvObj, msg.replace(/^image\:/, ''));
            } else if (/^voice\:/.test(msg)) {
                if (secret.EnableVoice) {
                    sendVoice(recvObj, msg.replace(/^voice\:/, ''));
                } else {
                    sendText(recvObj, '未开启语音功能哦~');
                }
            } else {
                // sendTTS(recvObj, msg);
                sendText(recvObj, msg);
            }
            return;
        }
    }

    AIQQBot(inputText, recvObj);
}

async function AIQQBot(inputText, recvObj) {
    const params = {
        app_id: secret.AI_QQ_APPID,
        time_stamp: parseInt(Date.now() / 1000),
        nonce_str: uuid().replace(/-/g, ''),
        sign: '',
        session: recvObj.qq,
        question: inputText
    }

    const paramKeys = Object.keys(params);
    paramKeys.sort();

    let str = '';
    for (const key of paramKeys) {
        if (key != 'sign') {
            str += (str == '' ? '' : '&') + `${key}=${key=='question'?encodeURI(params[key]):params[key]}`
        }
    }
    str += `&app_key=${secret.AI_QQ_APPKEY}`;
    params.sign = crypto.createHash('md5').update(str).digest('hex').toUpperCase();

    let botObj;
    try {
        botObj = await new Promise((resolve, reject) => {
            request.post('https://api.ai.qq.com/fcgi-bin/nlp/nlp_textchat', {
                form: params,
                json: true
            }, (err, res, body) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (body.ret == 0) {
                    console.log('AI Bot:', body.data.answer);
                    resolve(body);
                } else {
                    resolve(null);
                }
            });
        });
    } catch {
        sendText(recvObj, '电波出了点问题~喵');
        return;
    }

    if (!botObj) {
        sendImage(recvObj, `${secret.emoticonsPath}${path.sep}satania_cry.gif`);
        return;
    }

    // if (botObj.data.answer.length > 50) {
    //     sendText(recvObj, botObj.data.answer);
    // } else {
    //     sendTTS(recvObj, botObj.data.answer);
    // }
    sendText(recvObj, botObj.data.answer);
}

async function sendTTS(recvObj, text) {
    let tts;
    if (secret.EnableVoice) {
        try {
            tts = await speechClient.text2audio(text, {
                per: 103,
                pit: 7
            });
        } catch {
            sendText(recvObj, text);
            return;
        }
    }
    if (tts && tts.data) {
        voicePath = path.join(secret.tempPath, 'voice', 'aipSpeech_' + uuid() + '.mp3');
        fs.writeFileSync(voicePath, tts.data);
        sendVoice(recvObj, voicePath);
    } else {
        sendText(recvObj, text);
    }
}