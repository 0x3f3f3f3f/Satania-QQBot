const _ = require('lodash');
const sharp = require('sharp');
const request = require('request');

module.exports = async function (url) {
    if (!url) return;
    let width = 0;
    let height = 0;

    await new Promise(resolve => {
        request.get(url, {
            encoding: null
        }, async (err, res, body) => {
            if (!err && _.isBuffer(body)) {
                let metadata;
                try {
                    metadata = await sharp(body).metadata();
                } catch {
                    resolve();
                    return;
                }
                width = metadata.width;
                height = metadata.height;
            }
            resolve();
        });
    });

    return {
        url,
        width,
        height
    };
}