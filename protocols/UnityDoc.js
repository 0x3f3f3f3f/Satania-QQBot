const request = require('request');
const _ = require('lodash');
const messageHelper = require('../libs/messageHelper');

const DocType = {
    api: 0,
    manual: 1
};
const DocUrl = {
    [0]: 'https://docs.unity3d.com/ScriptReference/',
    [1]: 'https://docs.unity3d.com/Manual/'
}

module.exports = function (recvObj) {
    let type = null;
    const inputText = messageHelper.getText(recvObj.message).trim();
    if (/api/i.test(inputText)) {
        type = DocType.api;
    } else if (/手册/i.test(inputText)) {
        type = DocType.manual;
    }
    if (type != null) {
        UnityDoc(type, recvObj, inputText);
        return true
    }
    return false;
}

async function UnityDoc(type, recvObj, inputText) {
    let searchText = inputText.replace(/api|手册/g, '').trim();
    if (_.isEmpty(searchText)) {
        sendText(recvObj, '你居然没写关键词？');
        return;
    }

    sendText(recvObj, '搜索中~');

    let result;
    try {
        result = await new Promise((resolve, reject) => {
            request.post(`${secret.serviceRootUrl}/service/UnityDoc`, {
                json: {
                    type,
                    text: searchText
                }
            }, (err, res, body) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(body);
            });
        });

        if (result.err) {
            switch (result.err) {
                case 'noready':
                    sendText(recvObj, '萨塔尼亚还没准备好~');
                    return;
                case 'neterr':
                    sendText(recvObj, '欧尼酱搜索出错了~喵');
                    return;
                case 'nofind':
                    sendText(recvObj, '欧尼酱对不起，没有找到你要的~');
                    return;
            }
        }
    } catch {
        sendText(recvObj, '欧尼酱搜索出错了~喵');
        return;
    }

    const message = [{
        type: 'At',
        target: recvObj.qq
    }];
    const infoText = result.infoText.split('\n');
    for (let i = 0; i < result.results.length; i++) {
        const res = result.results[i];
        if (i == 0) {
            message.push({
                type: 'Plain',
                text: '\n'
            });
        } else {
            message.push({
                type: 'Plain',
                text: '\n\n'
            });
        }
        message.push({
            type: 'Plain',
            text: DocUrl[type] + res.url
        }, {
            type: 'Plain',
            text: `\n${res.title}: ${infoText[i]}`
        });
    }

    sendMsg(recvObj, message);
}