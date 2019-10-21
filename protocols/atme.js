module.exports = function (recvObj) {
    if ((new RegExp('QQ:at')).test(recvObj.params.content) &&
        (new RegExp(secret.targetQQ)).test(recvObj.params.content)) {
        return true;
    }
    return false;
}