const _ = require('lodash');

module.exports = function (recvObj) {
    const arr = recvObj.content.match(/\[.*?\]/g);
    if (!_.isArray(arr)) return false;

    for (let i = 0; i < arr.length; i++) {
        const CQ = arr[i].replace(/\[|\]/g, '').split(',');
        if (CQ[0] == 'CQ:at' && CQ[1] == `qq=${secret.targetQQ}`) {
            return true;
        }
    }
    return false;
}