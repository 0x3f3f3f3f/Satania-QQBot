const pixivImg = require('../lib/getPixivImage');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const uuid = require('uuid').v4;
const childProcess = require('child_process');

let isUpdating = false;

module.exports = async function (req, res) {
    const event = req.body.evnt;
    const tagList = req.body.tagList;
    const imgUrl = req.body.url;

    switch (event) {
        case 'updateIllusts':
            updateIllusts(tagList);
            res.json({
                result: true
            });
            break;
        case 'getStatus':
            res.json({
                isUpdating
            });
            break;
        default:
            try {
                // const illustPath = path.join(secret.imagePath, 'illust_' + path.basename(imgUrl));
                const illustPath = path.join(secret.imagePath, 'illust_' + uuid() + '.jpg');
                const sourceImg = sharp(await pixivImg(imgUrl));
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
                    .jpeg({
                        quality: 92,
                        chromaSubsampling: '4:4:4'
                    })
                    .toBuffer();
                fs.writeFileSync(illustPath, imgBuffer);
                res.json({
                    url: `${secret.imageRootUrl}/${path.basename(illustPath)}`
                });
            } catch {
                res.json({
                    err: true
                });
            }
            break;
    }
}

async function updateIllusts(tagList) {
    isUpdating = true;
    const js1 = childProcess.fork('Pixiv_database.js', [tagList.sex.join(), 'day_sex', 0, 0, 14]);
    const js2 = childProcess.fork('Pixiv_database.js', [tagList.char.join(), 'day_char', 0, 0, 14]);
    await Promise.all([
        new Promise(resolve => js1.on('close', resolve)),
        new Promise(resolve => js2.on('close', resolve))
    ]);
    isUpdating = false;
}