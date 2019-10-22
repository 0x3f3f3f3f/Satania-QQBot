const uuid = require('uuid/v1');

module.exports = function (recvObj, client) {
    if (!repeaterMode[recvObj.params.group] &&
        repeaterDic[recvObj.params.group] == recvObj.params.content) {
        repeaterMode[recvObj.params.group] = true;

        client.sendObj({
            id: uuid(),
            method: "sendMessage",
            params: {
                type: recvObj.params.type,
                group: recvObj.params.group || '',
                qq: recvObj.params.qq || '',
                content: recvObj.params.content
            }
        });
    } else if (repeaterMode[recvObj.params.group] &&
        repeaterDic[recvObj.params.group] != recvObj.params.content) {
        repeaterMode[recvObj.params.group] = false;
    }

    // 记录最后一条聊天信息
    repeaterDic[recvObj.params.group] = recvObj.params.content;
}

const repeaterMode = {};
// 复读机字典
const repeaterDic = {};