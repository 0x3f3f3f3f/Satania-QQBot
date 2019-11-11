module.exports = function (recvObj) {
    if ((new RegExp('CQ:at')).test(recvObj.content) &&
        (new RegExp(secret.targetQQ)).test(recvObj.content)) {
        return true;
    }
    return false;
}