const _ = require('lodash');
const messageHelper = require('../libs/messageHelper');

module.exports = function (recvObj) {
    const atqq = messageHelper.getAt(recvObj.message);
    if (atqq == secret.targetQQ) {
        return true;
    }
    return false;
}