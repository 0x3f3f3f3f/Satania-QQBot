const WebSocket = require('ws');
const request = require('request');
const _ = require('lodash');
const fs = require('fs');

// 账号密码
const secret = JSON.parse(fs.readFileSync('./secret.json', 'utf8'));

const client = new WebSocket(`ws://${secret.coolqHost}:${secret.coolqPort}/?access_token=${secret.coolqAccessToken}`);

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

    let receiveObj;
    try {
        receiveObj = JSON.parse(data);
    } catch {}
    if (_.isEmpty(receiveObj)) return;

    // log返回值
    if (receiveObj.status && receiveObj.retcode)
        console.log('return:', receiveObj);

    if (!receiveObj.message) return;

    console.log('msg:', receiveObj.message);

    let atMe = false;
    if ((new RegExp('CQ:at')).test(receiveObj.message) &&
        (new RegExp(`qq=${secret.targetQQ}`)).test(receiveObj.message)) {
        atMe = true;
    }

    // 被at了
    if (atMe) {
        // 搜图功能
        if ((/搜.*图/).test(receiveObj.message)) {
            const imgURL = getFirstImageURL(receiveObj.message);
            if (!imgURL) {
                client.send(JSON.stringify({
                    action: 'send_msg',
                    params: {
                        message_type: receiveObj.message_type || null,
                        user_id: receiveObj.user_id || null,
                        group_id: receiveObj.group_id || null,
                        discuss_id: receiveObj.discuss_id || null,
                        message: '欧尼酱搜图的话请至少要一张图哦~'
                    }
                }));
            } else {
                SauceNAO(imgURL);
            }
        } else {
            client.send(JSON.stringify({
                action: 'send_msg',
                params: {
                    message_type: receiveObj.message_type || null,
                    user_id: receiveObj.user_id || null,
                    group_id: receiveObj.group_id || null,
                    discuss_id: receiveObj.discuss_id || null,
                    message: '欧尼酱~想我了吗？'
                }
            }));
        }
    }

    async function SauceNAO(url) {
        let saucenaoObj;
        try {
            saucenaoObj = await new Promise((resolve, reject) => {
                request.get(encodeURI(`https://saucenao.com/search.php?db=999&output_type=2&numres=1&api_key=${secret.SauceNAO_API_KEY}&url=${url}`),
                    (error, response, body) => {
                        if (error) {
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
                action: 'send_msg',
                params: {
                    message_type: receiveObj.message_type || null,
                    user_id: receiveObj.user_id || null,
                    group_id: receiveObj.group_id || null,
                    discuss_id: receiveObj.discuss_id || null,
                    message: '欧尼酱搜索出错了~喵'
                }
            }));
            return;
        }
        if (!saucenaoObj.results) {
            client.send(JSON.stringify({
                action: 'send_msg',
                params: {
                    message_type: receiveObj.message_type || null,
                    user_id: receiveObj.user_id || null,
                    group_id: receiveObj.group_id || null,
                    discuss_id: receiveObj.discuss_id || null,
                    message: '欧尼酱对不起，没有找到你要的~'
                }
            }));
            return;
        }
        client.send(JSON.stringify({
            action: 'send_msg',
            params: {
                message_type: receiveObj.message_type || null,
                user_id: receiveObj.user_id || null,
                group_id: receiveObj.group_id || null,
                discuss_id: receiveObj.discuss_id || null,
                message: [{
                        type: 'at',
                        data: {
                            qq: receiveObj.user_id
                        }
                    },
                    {
                        type: 'text',
                        data: {
                            text: ' 欧尼酱是不是你想要的内个~\r\n' +
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
                                        saucenaoObj.results[0].data.creator}\r\n` : '')
                        }
                    },
                    {
                        type: 'image',
                        data: {
                            file: saucenaoObj.results[0].header.thumbnail
                        }
                    },
                    {
                        type: 'text',
                        data: {
                            text: (saucenaoObj.results[0].data.ext_urls ? ('\r\n' + saucenaoObj.results[0].data.ext_urls[0]) : '')
                        }
                    }
                ]
            }
        }));
    }

    // 启动复读机模式
    if (!repeaterMode &&
        lastMassage == receiveObj.message) {
        repeaterMode = true;
        client.send(JSON.stringify({
            action: 'send_msg',
            params: {
                message_type: receiveObj.message_type || null,
                user_id: receiveObj.user_id || null,
                group_id: receiveObj.group_id || null,
                discuss_id: receiveObj.discuss_id || null,
                message: receiveObj.message
            }
        }));
    } else if (repeaterMode &&
        lastMassage != receiveObj.message) {
        repeaterMode = false;
    }

    // 记录最后一条聊天信息
    lastMassage = receiveObj.message;
});

client.on('pong', () => {
    // console.log('pong!');
});

client.on('close', (code, reason) => {
    console.log('closed:', code, reason);
});

function getFirstImageURL(message) {
    const cqArray = message.match(/\[.*?\]/g);
    if (!_.isArray(cqArray)) return null;

    for (let i = 0; i < cqArray.length; i++) {
        const cq = cqArray[i].replace(/\[|\]/g, '').split(',');
        if (cq[0] == 'CQ:image')
            return cq[2].replace('url=', '');
    }
}