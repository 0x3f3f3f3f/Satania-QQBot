const _ = require('lodash');
const fs = require('fs');
const path = require('path');

module.exports = function (content) {
    const arr = content.match(/\[.*?\]/g);
    if (!_.isArray(arr)) return null;

    for (let i = 0; i < arr.length; i++) {
        const qq = arr[i].replace(/\[|\]/g, '').split('=');
        if (qq[0] == 'QQ:pic') {
            const iniPath = path.join(secret.tempPath, 'image', path.basename(qq[1], path.extname(qq[1])) + '.ini');
            const ini = fs.readFileSync(iniPath, 'utf8');
            return /^url=(.*)$/m.exec(ini)[1].trim();
        }
    }
}