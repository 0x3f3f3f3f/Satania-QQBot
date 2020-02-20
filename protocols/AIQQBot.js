const request = require('request');
const _ = require('lodash');
const uuid = require('uuid/v4');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const localRules = JSON.parse(fs.readFileSync('./protocols/AIQQBot_local_rules.json', 'utf8'));

module.exports = function (recvObj, client) {
    inputText = recvObj.content.replace(/\[.*?\]/g, '').trim();
    if (_.isEmpty(inputText)) {
        client.sendMsg(recvObj, (Math.random() > 0.5) ? `[QQ:pic=${secret.emoticonsPath}${path.sep}satania_cry.gif]` : '欧尼酱~想我了吗？');
        return;
    }

    // 拦截规则
    for (let i = localRules.length - 1; i >= 0; i--) {
        if (new RegExp(localRules[i].regExp, 'im').test(inputText)) {
            const index = parseInt(Math.random() * localRules[i].msgList.length);
            let msg = localRules[i].msgList[index];
            msg = msg.replace('emoticons', secret.emoticonsPath);
            msg = msg.replace(/\//g, path.sep);
            client.sendMsg(recvObj, msg);
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

    client.sendMsg(recvObj, botObj.data.answer);
}