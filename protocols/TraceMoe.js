const request = require('request');
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid/v4');
const getFirstImageInfo = require('../lib/getFirstImageInfo');
const gifFrames = require('gif-frames');
const sharp = require('sharp');

module.exports = function (recvObj, client, isPending = false) {
    if (isPending) {
        const imgInfo = getFirstImageInfo(recvObj.content);
        if (!imgInfo) {
            client.sendMsg(recvObj, '欧尼酱搜图的话请至少要一张图哦~');
        } else {
            TraceMoe(imgInfo, recvObj, client);
        }
        appEvent.emit('TraceMoe_done', recvObj);
        return;
    }
    if (/(搜|查|找).*?(番|动画|动漫)|(番|动画|动漫).*?(搜|查|找)/m.test(recvObj.content)) {
        const imgInfo = getFirstImageInfo(recvObj.content);
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

    let tracemoeObj;

    try {
        // gif的情况需要使用gif-frames模块拿到第一帧
        const gifStream = (await gifFrames({
            url: imgInfo.url,
            frames: 0
        }))[0].getImage();

        const imgBase64 = await new Promise((resolve, reject) => {
            let buffer = [];
            gifStream.on('error', reject);
            gifStream.on('data', data => buffer.push(data))
            gifStream.on('end', () => resolve(Buffer.concat(buffer).toString('base64')));
        });

        tracemoeObj = await new Promise((resolve, reject) => {
            request.post('https://trace.moe/api/search', {
                headers: {
                    "Content-Type": "application/json"
                },
                body: {
                    image: 'data:image/jpeg;base64,' + imgBase64
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
        try {
            tracemoeObj = await new Promise((resolve, reject) => {
                request.get('https://trace.moe/api/search', {
                    qs: {
                        url: imgInfo.url
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
            client.sendMsg(recvObj, '欧尼酱搜索出错了~喵');
            return;
        }
    }

    if (!tracemoeObj.docs) {
        client.sendMsg(recvObj, '欧尼酱对不起，没有找到你要的~');
        return;
    }

    const imagePath = await new Promise(resolve => {
        request.get('https://trace.moe/thumbnail.php', {
            qs: {
                anilist_id: tracemoeObj.docs[0].anilist_id,
                file: tracemoeObj.docs[0].filename,
                t: tracemoeObj.docs[0].at,
                token: tracemoeObj.docs[0].tokenthumb
            },
            encoding: null
        }, async (err, res, body) => {
            let imagePath = null;
            if (!err && _.isBuffer(body)) {
                imagePath = path.join(secret.tempPath, 'image', 'tracemoe_' + uuid() + '.jpg');
                fs.writeFileSync(imagePath, body);
                const sourceImg = sharp(imagePath);
                const sourceImgMetadata = await sourceImg.metadata();
                const waterMarkImg = sharp('watermark.png');
                const waterMarkImgMetadata = await waterMarkImg.metadata();
                const x = sourceImgMetadata.width - waterMarkImgMetadata.width - (parseInt(Math.random() * 5) + 6);
                const y = sourceImgMetadata.height - waterMarkImgMetadata.height - (parseInt(Math.random() * 5) + 6);
                const waterMarkBuffer = await waterMarkImg.extract({
                    left: x < 0 ? -x : 0,
                    top: y < 0 ? -y : 0,
                    width: x < 0 ? waterMarkImgMetadata.width + x : waterMarkImgMetadata.width,
                    height: y < 0 ? waterMarkImgMetadata.height + y : waterMarkImgMetadata.height
                }).toBuffer();
                const imgBuffer = await sourceImg
                    .composite([{
                        input: waterMarkBuffer,
                        left: x < 0 ? 0 : x,
                        top: y < 0 ? 0 : y
                    }])
                    .toBuffer();
                fs.writeFileSync(imagePath, imgBuffer);
            }
            resolve(imagePath);
        });
    });

    client.sendMsg(recvObj, `[QQ:at=${recvObj.qq}]` +
        ' 欧尼酱是不是你想要的内个~\r\n' +
        (tracemoeObj.docs[0].title_native ? `原名：${tracemoeObj.docs[0].title_native }\r\n` : '') +
        (tracemoeObj.docs[0].title_chinese ? `中文名：${tracemoeObj.docs[0].title_chinese }\r\n` : '') +
        (tracemoeObj.docs[0].title_english ? `英文名：${tracemoeObj.docs[0].title_english }\r\n` : '') +
        `相似度：${(tracemoeObj.docs[0].similarity * 100).toFixed(2)}%\r\n` +
        `匹配${tracemoeObj.docs[0].episode||'?'}话 ` +
        (parseInt(tracemoeObj.docs[0].at / 3600) == 0 ? '' : (parseInt(tracemoeObj.docs[0].at / 3600) + '时')) +
        (parseInt(tracemoeObj.docs[0].at % 3600 / 60) == 0 ? '' : (parseInt(tracemoeObj.docs[0].at % 3600 / 60) + '分')) +
        (parseInt(tracemoeObj.docs[0].at % 60) == 0 ? '' : (parseInt(tracemoeObj.docs[0].at % 60) + '秒')) +
        (imagePath ? `\r\n[QQ:pic=${imagePath}]` : '')
    );
}