const _ = require('lodash');
const fs = require('fs');
const path = require('path');

module.exports = function (content) {
    const arr = content.match(/\[.*?\]/g);
    if (!_.isArray(arr)) return null;

    for (let i = 0; i < arr.length; i++) {
        const CQ = arr[i].replace(/\[|\]/g, '').split(',');
        if (CQ[0] == 'CQ:image') {
            CQ[1] = CQ[1].split('=')[1];
            const cqimgPath = path.join(secret.tempPath, 'image', CQ[1] + '.cqimg');
            const cqimg = fs.readFileSync(cqimgPath, 'utf8');
            return {
                url: /^url=(.*)$/m.exec(cqimg)[1].trim(),
                width: parseInt(/^width=(.*)$/m.exec(cqimg)[1]),
                height: parseInt(/^height=(.*)$/m.exec(cqimg)[1])
            };
        }
    }
}