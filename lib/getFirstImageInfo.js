const _ = require('lodash');
const fs = require('fs');
const path = require('path');

module.exports = function (content) {
    const arr = content.match(/\[.*?\]/g);
    if (!_.isArray(arr)) return null;

    for (let i = 0; i < arr.length; i++) {
        const QQ = arr[i].replace(/\[|\]/g, '').split('=');
        if (QQ[0] == 'QQ:pic') {
            QQ[1] = path.basename(QQ[1], path.extname(QQ[1]));
            const iniPath = path.join(secret.tempPath, 'image', QQ[1] + '.ini');
            const iniContent = fs.readFileSync(iniPath, 'utf8');
            return {
                url: /^url=(.*)$/m.exec(iniContent)[1].trim(),
                width: parseInt(/^width=(.*)$/m.exec(iniContent)[1]),
                height: parseInt(/^height=(.*)$/m.exec(iniContent)[1])
            };
        }
    }
}