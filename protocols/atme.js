const _ = require('lodash');
const messageHelper = require('../lib/messageHelper');

module.exports = function (recvObj) {
    const atqq = messageHelper.getAt(recvObj.message);
    if (atqq == secret.targetQQ) {
        return true;
    }
    return false;
}