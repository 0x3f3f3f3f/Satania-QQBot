const request = require('request');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const _ = require('lodash');
const uuid = require('uuid').v4;
const gifFrames = require('gif-frames');

module.exports = async function (req, res) {
    const url = req.body.url;

    let tracemoeObj;
    try {
        // gif的情况需要使用gif-frames模块拿到第一帧
        const gifStream = (await gifFrames({
            url,
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
                json: {
                    image: 'data:image/jpeg;base64,' + imgBase64
                }
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
            res.json({
                err: 'neterr'
            });
            return;
        }
    }

    if (!tracemoeObj.docs) {
        res.json({
            err: 'nofind'
        });
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
                imagePath = path.join(secret.imagePath, 'tracemoe_' + uuid() + '.jpg');
                const sourceImg = sharp(body);
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

    if (imagePath) {
        res.json({
            tracemoeObj: tracemoeObj.docs[0],
            imageUrl: `${secret.imageRootUrl + (secret.imageRootUrl.startsWith('http') ? '/' : path.sep) + path.basename(imagePath)}`
        });
    } else {
        res.json({
            tracemoeObj: tracemoeObj.docs[0]
        });
    }
}