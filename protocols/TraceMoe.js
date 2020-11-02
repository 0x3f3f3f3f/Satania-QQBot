const request = require('request');
const getFirstImageInfo = require('../lib/getFirstImageInfo');

module.exports = async function (recvObj, client, isPending = false) {
    if (isPending) {
        const imgInfo = await getFirstImageInfo(recvObj.content);
        if (!imgInfo) {
            client.sendMsg(recvObj, '欧尼酱搜图的话请至少要一张图哦~');
        } else {
            TraceMoe(imgInfo, recvObj, client);
        }
        appEvent.emit('TraceMoe_done', recvObj);
        return;
    }
    if (/(搜|查|找).*?(番|动画|动漫)|(番|动画|动漫).*?(搜|查|找)/.test(recvObj.content)) {
        const imgInfo = await getFirstImageInfo(recvObj.content);
        if (!imgInfo) {
            client.sendMsg(recvObj, '收到！接下来请单独发一张图片给我搜索~');
            appEvent.emit('TraceMoe_pending', recvObj);
        } else {
            TraceMoe(imgInfo, recvObj, client);
        }
        return true;
    }
    return false;
}

async function TraceMoe(imgInfo, recvObj, client) {
    if (imgInfo.width / imgInfo.height < 1.2) {
        client.sendMsg(recvObj, '欧尼酱~你是不是又在拿表情包逗我？');
        return;
    }

    client.sendMsg(recvObj, '搜索中~');

    let result;
    try {
        result = await new Promise((resolve, reject) => {
            request.post(`${secret.serviceRootUrl}/service/TraceMoe`, {
                json: {
                    url: imgInfo.url
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

    client.sendMsg(recvObj, `[CQ:at,qq=${recvObj.qq}]` +
        ' 欧尼酱是不是你想要的内个~\r\n' +
        (result.tracemoeObj.title_native ? `原名：${result.tracemoeObj.title_native}\r\n` : '') +
        (result.tracemoeObj.title_chinese ? `中文名：${result.tracemoeObj.title_chinese}\r\n` : '') +
        (result.tracemoeObj.title_english ? `英文名：${result.tracemoeObj.title_english}\r\n` : '') +
        `相似度：${(result.tracemoeObj.similarity * 100).toFixed(2)}%\r\n` +
        `匹配${result.tracemoeObj.episode||'?'}话 ` +
        (parseInt(result.tracemoeObj.at / 3600) == 0 ? '' : (parseInt(result.tracemoeObj.at / 3600) + '时')) +
        (parseInt(result.tracemoeObj.at % 3600 / 60) == 0 ? '' : (parseInt(result.tracemoeObj.at % 3600 / 60) + '分')) +
        (parseInt(result.tracemoeObj.at % 60) == 0 ? '' : (parseInt(result.tracemoeObj.at % 60) + '秒')) +
        (result.imageUrl ? `\r\n[CQ:image,file=${result.imageUrl}]` : '')
    );
}