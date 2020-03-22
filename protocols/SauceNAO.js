const request = require('request');
const getFirstImageInfo = require('../lib/getFirstImageInfo');

module.exports = function (recvObj, client, isPending = false) {
    if (isPending) {
        const imgInfo = getFirstImageInfo(recvObj.content);
        if (!imgInfo) {
            client.sendMsg(recvObj, '欧尼酱搜图的话请至少要一张图哦~');
        } else {
            SauceNAO(imgInfo.url, recvObj, client);
        }
        appEvent.emit('SauceNao_done', recvObj);
        return;
    }
    if (/((搜|查|找).*?图)|(图.*?(搜|查|找))/.test(recvObj.content)) {
        const imgInfo = getFirstImageInfo(recvObj.content);
        if (!imgInfo) {
            client.sendMsg(recvObj, '收到！接下来请单独发一张图片给我搜索~');
            appEvent.emit('SauceNao_pending', recvObj);
        } else {
            SauceNAO(imgInfo.url, recvObj, client);
        }
        return true;
    }
    return false;
}

async function SauceNAO(url, recvObj, client) {
    client.sendMsg(recvObj, '搜索中~');

    let result;
    try {
        result = await new Promise((resolve, reject) => {
            request.post(`${secret.serviceRootUrl}/service/SauceNAO`, {
                json: {
                    url
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

    client.sendMsg(recvObj, `[QQ:at=${recvObj.qq}]` +
        ' 欧尼酱是不是你想要的内个~\r\n' +
        `相似度：${result.saucenaoObj.header.similarity}%\r\n` +
        ((result.saucenaoObj.data.title ||
            result.saucenaoObj.data.jp_name ||
            result.saucenaoObj.data.eng_name) ? `标题：${
                    result.saucenaoObj.data.title||
                    result.saucenaoObj.data.jp_name||
                    result.saucenaoObj.data.eng_name}\r\n` : '') +
        ((result.saucenaoObj.data.member_name ||
            result.saucenaoObj.data.author_name ||
            result.saucenaoObj.data.creator) ? `作者：${
                    result.saucenaoObj.data.member_name||
                    result.saucenaoObj.data.author_name||
                    result.saucenaoObj.data.creator}\r\n` : '') +
        (result.imageUrl ? `[QQ:pic=${result.imageUrl}]` : '') +
        (result.saucenaoObj.data.ext_urls ? ('\r\n' + result.saucenaoObj.data.ext_urls[0]) : '')
    );
}