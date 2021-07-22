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

        tracemoeObj = await new Promise((resolve, reject) => {
            request.post('https://api.trace.moe/search?anilistInfo', {
                formData: {
                    value: gifStream,
                    options: {
                        filename: "image.jpg"
                    }
                },
                json: true
            }, (err, res, body) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (body.result && !_.isEmpty(body.result))
                    console.log('TraceMoe API:', body.result[0].anilist.title.native);
                resolve(body);
            });
        });
    } catch {
        try {
            tracemoeObj = await new Promise((resolve, reject) => {
                request.get('https://api.trace.moe/search?anilistInfo', {
                    qs: {
                        url
                    },
                    json: true
                }, (err, res, body) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    if (body.result && !_.isEmpty(body.result))
                        console.log('TraceMoe API:', body.result[0].anilist.title.native);
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

    if (!tracemoeObj.result || _.isEmpty(tracemoeObj.result)) {
        res.json({
            err: 'nofind'
        });
        return;
    }

    const imagePath = await new Promise(resolve => {
        request.get(tracemoeObj.result[0].image, {
            encoding: null
        }, async (err, res, body) => {
            let imagePath = null;
            if (!err && _.isBuffer(body)) {
                imagePath = path.join(secret.imagePath, 'tracemoe_' + uuid() + '.jpg');
                let sourceImg, sourceImgMetadata;
                try {
                    sourceImg = sharp(body);
                    sourceImgMetadata = await sourceImg.metadata();
                } catch {
                    resolve(null);
                    return;
                }
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
            tracemoeObj: tracemoeObj.result[0],
            imageUrl: `${secret.imageRootUrl + (secret.imageRootUrl.startsWith('http') ? '/' : path.sep) + path.basename(imagePath)}`
        });
    } else {
        res.json({
            tracemoeObj: tracemoeObj.result[0]
        });
    }
}