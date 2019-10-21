const WebSocket = require('ws');
const request = require('request');
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid/v1');

// 账号密码
const secret = JSON.parse(fs.readFileSync('./secret.json', 'utf8'));

// 复读机字典
const repeaterDic = {};

const client = new WebSocket(`ws://${secret.coolqHost}:${secret.coolqPort}/`);

client.on('open', () => {
    console.log('opend!');
});

const heartBeat = setInterval(() => {
    if (client.readyState == WebSocket.OPEN)
        client.ping();
}, 15000);

let lastMassage;
let repeaterMode = false;

client.on('message', data => {
    if (!_.isString(data)) return;
    // console.log('=>', data);

    let recvObj;
    try {
        recvObj = JSON.parse(data);
    } catch {}
    if (_.isEmpty(recvObj)) return;

    // if (saucenaoDic[recvObj.id]) {
    //     sendSauceNAO(recvObj.id, recvObj.result);
    //     return;
    // }

    if (recvObj.event != 'message') {
        console.log('=>', recvObj);
        return;
    }

    console.log('content:', recvObj.params.content);

    let atMe = false;
    if ((new RegExp('QQ:at')).test(recvObj.params.content) &&
        (new RegExp(secret.targetQQ)).test(recvObj.params.content)) {
        atMe = true;
    }

    // 被at了
    if (atMe) {
        // 搜图功能
        if ((/搜.*图/).test(recvObj.params.content)) {
            const imgURL = getFirstImageURL(recvObj.params.content);
            if (!imgURL) {
                client.send(JSON.stringify({
                    id: uuid(),
                    method: "sendMessage",
                    params: {
                        type: recvObj.params.type,
                        group: recvObj.params.group || '',
                        qq: recvObj.params.qq || '',
                        content: '欧尼酱搜图的话请至少要一张图哦~'
                    }
                }));
            } else {
                searchSauceNAO(imgURL);
            }
        } else {
            client.send(JSON.stringify({
                id: uuid(),
                method: "sendMessage",
                params: {
                    type: recvObj.params.type,
                    group: recvObj.params.group || '',
                    qq: recvObj.params.qq || '',
                    content: '欧尼酱~想我了吗？'
                }
            }));
        }
    }

    async function searchSauceNAO(url) {
        let saucenaoObj;
        try {
            saucenaoObj = await new Promise((resolve, reject) => {
                request.get(encodeURI(`https://saucenao.com/search.php?db=999&output_type=2&numres=1&api_key=${secret.SauceNAO_API_KEY}&url=${url}`),
                    (err, res, body) => {
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
                            console.log('SauceNAO API:', JSON.stringify(result.results, null, 2));
                        resolve(result);
                    });
            });
        } catch {
            client.send(JSON.stringify({
                id: uuid(),
                method: "sendMessage",
                params: {
                    type: recvObj.params.type,
                    group: recvObj.params.group || '',
                    qq: recvObj.params.qq || '',
                    content: '欧尼酱搜索出错了~喵'
                }
            }));
            return;
        }
        if (!saucenaoObj.results) {
            client.send(JSON.stringify({
                id: uuid(),
                method: "sendMessage",
                params: {
                    type: recvObj.params.type,
                    group: recvObj.params.group || '',
                    qq: recvObj.params.qq || '',
                    content: '欧尼酱对不起，没有找到你要的~'
                }
            }));
            return;
        }

        client.send(JSON.stringify({
            id: uuid(),
            method: "sendMessage",
            params: {
                type: recvObj.params.type,
                group: recvObj.params.group || '',
                qq: recvObj.params.qq || '',
                content: `[QQ:at=${recvObj.params.qq}]` +
                    ' 欧尼酱是不是你想要的内个~\r\n' +
                    `相似度：${saucenaoObj.results[0].header.similarity}%\r\n` +
                    ((saucenaoObj.results[0].data.title ||
                        saucenaoObj.results[0].data.jp_name ||
                        saucenaoObj.results[0].data.eng_name) ? `标题：${
                        saucenaoObj.results[0].data.title||
                        saucenaoObj.results[0].data.jp_name||
                        saucenaoObj.results[0].data.eng_name}\r\n` : '') +
                    ((saucenaoObj.results[0].data.member_name ||
                        saucenaoObj.results[0].data.author_name ||
                        saucenaoObj.results[0].data.creator) ? `作者：${
                        saucenaoObj.results[0].data.member_name||
                        saucenaoObj.results[0].data.author_name||
                        saucenaoObj.results[0].data.creator}\r\n` : '') +
                    `[QQ:pic=${saucenaoObj.results[0].header.thumbnail}]` +
                    (saucenaoObj.results[0].data.ext_urls ? ('\r\n' + saucenaoObj.results[0].data.ext_urls[0]) : '')
            }
        }));
    }

    // 启动复读机模式
    if (!repeaterMode &&
        repeaterDic[recvObj.params.group] == recvObj.params.content) {
        repeaterMode = true;

        client.send(JSON.stringify({
            id: uuid(),
            method: "sendMessage",
            params: {
                type: recvObj.params.type,
                group: recvObj.params.group || '',
                qq: recvObj.params.qq || '',
                content: recvObj.params.content
            }
        }));
    } else if (repeaterMode &&
        repeaterDic[recvObj.params.group] != recvObj.params.content) {
        repeaterMode = false;
    }

    // 记录最后一条聊天信息
    repeaterDic[recvObj.params.group] = recvObj.params.content;
});

client.on('pong', () => {
    // console.log('pong!');
});

client.on('close', (code, reason) => {
    console.log('closed:', code, reason);
});

function getFirstImageURL(content) {
    const arr = content.match(/\[.*?\]/g);
    if (!_.isArray(arr)) return null;

    for (let i = 0; i < arr.length; i++) {
        const qq = arr[i].replace(/\[|\]/g, '').split('=');
        if (qq[0] == 'QQ:pic') {
            const iniPath = path.join(secret.tempPath, 'image', path.basename(qq[1], path.extname(qq[1])) + '.ini');
            const ini = fs.readFileSync(iniPath, 'utf8');
            return /^url=(.*)/m.exec(ini)[1].trim();
        }
    }
}