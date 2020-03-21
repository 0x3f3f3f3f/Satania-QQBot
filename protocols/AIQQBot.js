const request = require('request');
const _ = require('lodash');
const uuid = require('uuid/v4');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const localRules = JSON.parse(fs.readFileSync('./protocols/AIQQBot_local_rules.json', 'utf8'));

const AipSpeechClient = require('baidu-aip-sdk').speech;
const speechClient = new AipSpeechClient(secret.Baidu_APP_ID, secret.Baidu_API_KEY, secret.Baidu_SECRET_KEY);

module.exports = function (recvObj, client) {
    inputText = recvObj.content.replace(/\[.*?\]/g, '').trim();
    if (_.isEmpty(inputText)) {
        if (Math.random() > 0.5) {
            sendVoice(recvObj, client, '藕妮酱~想我了吗？');
        } else {
            client.sendMsg(recvObj, `[QQ:pic=${secret.emoticonsPath}${path.sep}satania_cry.gif]`);
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
            if (/QQ\:(pic|voice)/.test(msg)) {
                client.sendMsg(recvObj, msg);
            } else {
                sendVoice(recvObj, client, msg);
            }
            return;
        }
    }

    AIQQBot(inputText, recvObj, client);
}

async function AIQQBot(inputText, recvObj, client) {
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
                    reject();
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
        client.sendMsg(recvObj, '电波出了点问题~喵');
        return;
    }

    if (!botObj) {
        client.sendMsg(recvObj, `[QQ:pic=${secret.emoticonsPath}${path.sep}satania_cry.gif]`);
        return;
    }

    if (botObj.data.answer.length > 50) {
        client.sendMsg(recvObj, botObj.data.answer);
    } else {
        sendVoice(recvObj, client, botObj.data.answer);
    }
}

async function sendVoice(recvObj, client, text) {
    let tts;
    if (secret.EnableVoice) {
        try {
            tts = await speechClient.text2audio(text, {
                per: 103,
                pit: 7
            });
        } catch {
            client.sendMsg(recvObj, text);
            return;
        }
    }
    if (tts && tts.data) {
        voicePath = path.join(secret.tempPath, 'voice', 'aipSpeech_' + uuid() + '.mp3');
        fs.writeFileSync(voicePath, tts.data);
        client.sendMsg(recvObj, `[QQ:voice=${voicePath}]`);
    } else {
        client.sendMsg(recvObj, text);
    }
}