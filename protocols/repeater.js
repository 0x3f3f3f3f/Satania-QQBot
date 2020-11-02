module.exports = function (recvObj, client) {
    const headlessMsg = recvObj.message.shift();
    const str = JSON.stringify(headlessMsg);
    if (!repeaterMode[recvObj.group] &&
        repeaterDic[recvObj.group] == str) {
        repeaterMode[recvObj.group] = true;

        sendMsg(recvObj, headlessMsg);
    } else if (repeaterMode[recvObj.group] &&
        repeaterDic[recvObj.group] != str) {
        repeaterMode[recvObj.group] = false;
    }

    // 记录最后一条聊天信息
    repeaterDic[recvObj.group] = str;
}

const repeaterMode = {};
// 复读机字典
const repeaterDic = {};