const uuid = require('uuid/v1');

module.exports = function (recvObj, client) {
    if (!repeaterMode &&
        repeaterDic[recvObj.params.group] == recvObj.params.content) {
        repeaterMode = true;

        client.send(JSON.stringify({
            id: uuid(),
            method: "sendMessage",
            params: {
                type: recvObj.params.type,
                group: recvObj.params.group || '',
                qq: recvObj.params.qq || '',
                content: recvObj.params.content
            }
        }));
    } else if (repeaterMode &&
        repeaterDic[recvObj.params.group] != recvObj.params.content) {
        repeaterMode = false;
    }

    // 记录最后一条聊天信息
    repeaterDic[recvObj.params.group] = recvObj.params.content;
}

let repeaterMode = false;
// 复读机字典
const repeaterDic = {};