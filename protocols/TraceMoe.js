const request = require('request');
const getImageInfo = require('../libs/getImageInfo');
const messageHelper = require('../libs/messageHelper');

module.exports = async function (recvObj, isPending = false) {
    const imageUrl = messageHelper.getImage(recvObj.message);
    if (isPending) {
        const imgInfo = await getImageInfo(imageUrl);
        if (!imgInfo) {
            sendText(recvObj, '欧尼酱搜图的话请至少要一张图哦~');
        } else {
            TraceMoe(imgInfo, recvObj);
        }
        appEvent.emit('TraceMoe_done', recvObj);
        return;
    }
    const inputText = messageHelper.getText(recvObj.message).trim();
    if (/(搜|查|找).*?(番|动画|动漫)|(番|动画|动漫).*?(搜|查|找)/.test(inputText)) {
        const imgInfo = await getImageInfo(imageUrl);
        if (!imgInfo) {
            sendText(recvObj, '收到！接下来请单独发一张图片给我搜索~');
            appEvent.emit('TraceMoe_pending', recvObj);
        } else {
            TraceMoe(imgInfo, recvObj);
        }
        return true;
    }
    return false;
}

async function TraceMoe(imgInfo, recvObj) {
    if (imgInfo.width / imgInfo.height < 1.2) {
        sendText(recvObj, '欧尼酱~你是不是又在拿表情包逗我？');
        return;
    }

    sendText(recvObj, '搜索中~');

    let result;
    try {
        result = await new Promise((resolve, reject) => {
            request.post(`${secret.serviceRootUrl}/service/TraceMoe`, {
                json: {
                    url: imgInfo.url
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
        },
        {
            type: 'Plain',
            text: ' 欧尼酱是不是你想要的内个~'
        }
    ];
    if (result.tracemoeObj.anilist.title.native) {
        message.push({
            type: 'Plain',
            text: `\n原名：${result.tracemoeObj.anilist.title.native}`
        });
    }
    let title_cn;
    for (let i = result.tracemoeObj.anilist.synonyms.length - 1; i >= 0; i--) {
        if (/\p{Script=Han}/u.test(result.tracemoeObj.anilist.synonyms[i])) {
            title_cn = result.tracemoeObj.anilist.synonyms[i];
            break;
        }
    }
    if (title_cn) {
        message.push({
            type: 'Plain',
            text: `\n中文名：${title_cn}`
        });
    }
    if (result.tracemoeObj.anilist.title.romaji) {
        message.push({
            type: 'Plain',
            text: `\n罗马音：${result.tracemoeObj.anilist.title.romaji}`
        });
    }
    message.push({
        type: 'Plain',
        text: `\n相似度：${(result.tracemoeObj.similarity * 100).toFixed(2)}%`
    }, {
        type: 'Plain',
        text: `\n匹配${result.tracemoeObj.episode||'?'}话 ` +
            (parseInt(result.tracemoeObj.from / 3600) == 0 ? '' : (parseInt(result.tracemoeObj.from / 3600) + '时')) +
            (parseInt(result.tracemoeObj.from % 3600 / 60) == 0 ? '' : (parseInt(result.tracemoeObj.from % 3600 / 60) + '分')) +
            (parseInt(result.tracemoeObj.from % 60) == 0 ? '' : (parseInt(result.tracemoeObj.from % 60) + '秒'))
    });
    if (result.imageUrl) {
        message.push({
            type: 'Plain',
            text: '\n'
        }, {
            type: 'Image',
            url: result.imageUrl
        });
    }

    sendMsg(recvObj, message);
}