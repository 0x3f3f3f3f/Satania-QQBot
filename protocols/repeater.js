module.exports = function (recvObj, client) {
    if (!repeaterMode[recvObj.group] &&
        repeaterDic[recvObj.group] == recvObj.content) {
        repeaterMode[recvObj.group] = true;

        client.sendMsg(recvObj, recvObj.content);
    } else if (repeaterMode[recvObj.group] &&
        repeaterDic[recvObj.group] != recvObj.content) {
        repeaterMode[recvObj.group] = false;
    }

    // 记录最后一条聊天信息
    repeaterDic[recvObj.group] = recvObj.content;
}

const repeaterMode = {};
// 复读机字典
const repeaterDic = {};