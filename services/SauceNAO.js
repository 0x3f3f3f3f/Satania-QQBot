const request = require('request');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
sharp.cache(false);
const _ = require('lodash');
const uuid = require('uuid/v4');

module.exports = async function (req, res) {
    const url = req.body.url;

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
        res.json({
            err: 'neterr'
        });
        return;
    }

    if (!saucenaoObj.results) {
        res.json({
            err: 'nofind'
        });
        return;
    }

    const imagePath = await new Promise(resolve => {
        request.get(saucenaoObj.results[0].header.thumbnail, {
            encoding: null
        }, async (err, res, body) => {
            let imagePath = null;
            if (!err && _.isBuffer(body)) {
                imagePath = path.join(secret.imagePath, 'saucenao_' + uuid() + '.jpg');
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

    if (imagePath) {
        res.json({
            saucenaoObj: saucenaoObj.results[0],
            imageUrl: `${secret.publicDomainName}/image/${path.basename(imagePath)}`
        });
    } else {
        res.json({
            saucenaoObj: saucenaoObj.results[0]
        });
    }
}