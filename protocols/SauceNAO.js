const request = require('request');
const uuid = require('uuid/v4');
const getFirstImageInfo = require('../lib/getFirstImageInfo');

module.exports = function (recvObj, client, isPending = false) {
    if (isPending) {
        const imgInfo = getFirstImageInfo(recvObj.params.content);
        if (!imgInfo) {
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
            SauceNAO(imgInfo.url, recvObj, client);
        }
        appEvent.emit('SauceNao_done', recvObj);
        return;
    }
    if (/(搜.*?图)|(图.*?搜)/m.test(recvObj.params.content)) {
        const imgInfo = getFirstImageInfo(recvObj.params.content);
        if (!imgInfo) {
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
            appEvent.emit('SauceNao_pending', recvObj);
        } else {
            SauceNAO(imgInfo.url, recvObj, client);
        }
        return true;
    }
    return false;
}

async function SauceNAO(url, recvObj, client) {
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

    let saucenaoObj;
    try {
        saucenaoObj = await new Promise((resolve, reject) => {
            request.get('https://saucenao.com/search.php', {
                qs: {
                    db: 999,
                    output_type: 2,
                    numres: 1,
                    api_key: secret.SauceNAO_API_KEY,
                    url
                },
                json: true
            }, (err, res, body) => {
                if (err) {
                    reject();
                    return;
                }
                if (body.results)
                    console.log('SauceNAO API:', body.results[0].header.index_name);
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

    if (!saucenaoObj.results) {
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
    });
}