const request = require('request');
const _ = require('lodash');

const DocType = {
    api: 0,
    manual: 1
};
const DocUrl = {
    [0]: 'https://docs.unity3d.com/ScriptReference/',
    [1]: 'https://docs.unity3d.com/Manual/'
}

module.exports = function (recvObj, client) {
    let type = null;
    if (/api/ig.test(recvObj.content)) {
        type = DocType.api;
    } else if (/手.*?册/g.test(recvObj.content)) {
        type = DocType.manual;
    }
    if (type != null) {
        UnityDoc(type, recvObj, client);
        return true
    }
    return false;
}

async function UnityDoc(type, recvObj, client) {
    let searchText = recvObj.content.replace(/\[.*?\]|api|手.*?册/g, '').trim();
    if (_.isEmpty(searchText)) {
        client.sendMsg(recvObj, '你居然没写关键词？');
        return;
    }

    client.sendMsg(recvObj, '搜索中~');

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
                    reject();
                    return;
                }
                resolve(body);
            });
        });

        if (result.err) {
            switch (result.err) {
                case 'noready':
                    client.sendMsg(recvObj, '萨塔尼亚还没准备好~');
                    return;
                case 'neterr':
                    client.sendMsg(recvObj, '欧尼酱搜索出错了~喵');
                    return;
                case 'nofind':
                    client.sendMsg(recvObj, '欧尼酱对不起，没有找到你要的~');
                    return;
            }
        }
    } catch {
        client.sendMsg(recvObj, '欧尼酱搜索出错了~喵');
        return;
    }

    const infoText = result.infoText.split('\n');
    let resultText = '';
    for (let i = 0; i < result.results.length; i++) {
        const res = result.results[i];
        resultText += (resultText == '' ? '' : '\r\n') + '\r\n' +
            `[QQ:url=${DocUrl[type]+res.url}]\r\n${res.title}: ${infoText[i]}`
    }

    client.sendMsg(recvObj, `[QQ:at=${recvObj.qq}]\r\n` + resultText);
}