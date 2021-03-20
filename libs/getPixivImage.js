const request = require('request');
const _ = require('lodash');

module.exports = function (url) {
    return new Promise((resolve, reject) => {
        request.get(url, {
            encoding: null,
            headers: {
                'Referer': 'http://www.pixiv.net/'
            }
        }, (err, res, body) => {
            if (!err && _.isBuffer(body)) {
                resolve(body);
            } else {
                reject();
            }
        });
    });
}