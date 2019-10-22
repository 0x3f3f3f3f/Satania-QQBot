const request = require('request');
const _ = require('lodash');
const uuid = require('uuid/v1');

module.exports = function (recvObj, client) {
    inputText = recvObj.params.content.replace(/\[.*?\]/g, '').trim();
    if (_.isEmpty) {
        client.sendObj({
            id: uuid(),
            method: "sendMessage",
            params: {
                type: recvObj.params.type,
                group: recvObj.params.group || '',
                qq: recvObj.params.qq || '',
                content: (Math.random() > 0.5) ? '[QQ:pic=https://sub1.gameoldboy.com/satania.gif]' : '欧尼酱~想我了吗？'
            }
        });
        return;
    }
    TunlingBot(inputText, recvObj, client);
}

async function TunlingBot(inputText, recvObj, client) {
    let botObj;
    try {
        botObj = await new Promise((resolve, reject) => {
            request.post({
                url: 'http://openapi.tuling123.com/openapi/api/v2',
                json: true,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    reqType: 0,
                    perception: {
                        inputText
                    },
                    userInfo: {
                        apiKey: secret.Tunling_API_KEY,
                        userId: recvObj.params.qq || uuid()
                    }
                })
            }, (err, res, body) => {
                if (err) {
                    reject();
                    return;
                }
                let result;
                try {
                    result = JSON.parse(body);
                } catch {
                    reject();
                    return;
                }
                if (result.results)
                    console.log('Tunling Bot:', result.results[0].values.text);
                resolve(result);
            });
        });
    } catch {
        client.sendObj({
            id: uuid(),
            method: "sendMessage",
            params: {
                type: recvObj.params.type,
                group: recvObj.params.group || '',
                qq: recvObj.params.qq || '',
                content: '电波出了点问题~喵'
            }
        });
        return;
    }

    if (!botObj.results) {
        client.sendObj({
            id: uuid(),
            method: "sendMessage",
            params: {
                type: recvObj.params.type,
                group: recvObj.params.group || '',
                qq: recvObj.params.qq || '',
                content: `[QQ:pic=https://sub1.gameoldboy.com/satania.gif]`
            }
        });
        return;
    }

    client.sendObj({
        id: uuid(),
        method: "sendMessage",
        params: {
            type: recvObj.params.type,
            group: recvObj.params.group || '',
            qq: recvObj.params.qq || '',
            content: result.results[0].values.text
        }
    });
}