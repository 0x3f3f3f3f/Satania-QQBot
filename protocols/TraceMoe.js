const request = require('request');
const uuid = require('uuid/v4');
const getFirstImageURL = require('../lib/getFirstImageURL');

module.exports = function (recvObj, client, isPending = false) {
    if (isPending) {
        const imgURL = getFirstImageURL(recvObj.params.content);
        if (!imgURL) {
            client.sendObj({
                id: uuid(),
                method: "sendMessage",
                params: {
                    type: recvObj.params.type,
                    group: recvObj.params.group || '',
                    qq: recvObj.params.qq || '',
                    content: '欧尼酱搜图的话请至少要一张图哦~'
                }
            });
        } else {
            TraceMoe(imgURL, recvObj, client);
        }
        appEvent.emit('TraceMoe_done', recvObj);
        return;
    }
    if (/(搜|找).*?番|番.*?(搜|找)/m.test(recvObj.params.content)) {
        const imgURL = getFirstImageURL(recvObj.params.content);
        if (!imgURL) {
            client.sendObj({
                id: uuid(),
                method: "sendMessage",
                params: {
                    type: recvObj.params.type,
                    group: recvObj.params.group || '',
                    qq: recvObj.params.qq || '',
                    content: '收到！接下来请单独发一张图片给我搜索~'
                }
            });
            appEvent.emit('TraceMoe_pending', recvObj);
        } else {
            TraceMoe(imgURL, recvObj, client);
        }
        return true;
    }
    return false;
}

async function TraceMoe(url, recvObj, client) {
    client.sendObj({
        id: uuid(),
        method: "sendMessage",
        params: {
            type: recvObj.params.type,
            group: recvObj.params.group || '',
            qq: recvObj.params.qq || '',
            content: '搜索中~'
        }
    });

    let tracemoeObj;
    try {
        tracemoeObj = await new Promise((resolve, reject) => {
            request.get('https://trace.moe/api/search', {
                qs: {
                    url
                },
                json: true
            }, (err, res, body) => {
                if (err) {
                    reject();
                    return;
                }
                if (body.docs)
                    console.log('TraceMoe API:', body.docs[0].title);
                resolve(body);
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
                content: '欧尼酱搜索出错了~喵'
            }
        });
        return;
    }

    if (!tracemoeObj.docs) {
        client.sendObj({
            id: uuid(),
            method: "sendMessage",
            params: {
                type: recvObj.params.type,
                group: recvObj.params.group || '',
                qq: recvObj.params.qq || '',
                content: '欧尼酱对不起，没有找到你要的~'
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
            content: `[QQ:at=${recvObj.params.qq}]` +
                ' 欧尼酱是不是你想要的内个~\r\n' +
                (tracemoeObj.docs[0].title_native ? `原名：${tracemoeObj.docs[0].title_native }\r\n` : '') +
                (tracemoeObj.docs[0].title_chinese ? `中文名：${tracemoeObj.docs[0].title_chinese }\r\n` : '') +
                (tracemoeObj.docs[0].title_english ? `英文名：${tracemoeObj.docs[0].title_english }\r\n` : '') +
                '\r\n' +
                `匹配${tracemoeObj.docs[0].episode||'?'}话` +
                (parseInt(tracemoeObj.docs[0].at / 3600) == 0 ? '' : (parseInt(tracemoeObj.docs[0].at / 3600) + '时')) +
                (parseInt(tracemoeObj.docs[0].at % 3600 / 60) == 0 ? '' : (parseInt(tracemoeObj.docs[0].at % 3600 / 60) + '分')) +
                (parseInt(tracemoeObj.docs[0].at % 60) == 0 ? '' : (parseInt(tracemoeObj.docs[0].at % 60) + '秒')) +
                '\r\n' +
                `相似度：${(tracemoeObj.docs[0].similarity * 100).toFixed(2)}%\r\n` +
                `[QQ:pic=https://trace.moe/thumbnail.php?anilist_id=${tracemoeObj.docs[0].anilist_id}&file=${encodeURIComponent(tracemoeObj.docs[0].filename)}&t=${tracemoeObj.docs[0].at}&token=${tracemoeObj.docs[0].tokenthumb}]`
        }
    });
}