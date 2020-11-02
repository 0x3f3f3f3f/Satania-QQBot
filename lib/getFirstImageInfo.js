const _ = require('lodash');
const sharp = require('sharp');
const request = require('request');

module.exports = async function (content) {
    const arr = content.match(/\[.*?\]/g);
    if (!_.isArray(arr)) return null;

    for (let i = 0; i < arr.length; i++) {
        const CQ = arr[i].replace(/\[|\]/g, '').split(',');
        if (CQ[0] == 'CQ:image' && CQ[2].startsWith('url=')) {
            const url = /^url=(.*)$/m.exec(CQ[2])[1].trim();
            let width = 0;
            let height = 0;

            await new Promise(resolve => {
                request.get(url, {
                    encoding: null
                }, async (err, res, body) => {
                    if (!err && _.isBuffer(body)) {
                        const metadata = await sharp(body).metadata();
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
    }
}