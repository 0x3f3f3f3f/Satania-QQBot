const _ = require('lodash');

module.exports = function (recvObj) {
    const arr = recvObj.content.match(/\[.*?\]/g);
    if (!_.isArray(arr)) return false;

    for (let i = 0; i < arr.length; i++) {
        const QQ = arr[i].replace(/\[|\]/g, '').split('=');
        if (QQ[0] == 'QQ:at' && QQ[1] == secret.targetQQ) {
            return true;
        }
    }
    return false;
}