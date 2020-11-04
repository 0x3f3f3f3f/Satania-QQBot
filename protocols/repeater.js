module.exports = function (recvObj) {
    const headlessMsg = [];
    headlessMsg.push(...recvObj.message);
    headlessMsg.shift();
    // 删除图片的url，因为url字段每次会不同
    for (const msg of headlessMsg) {
        if (msg.type == 'Image') {
            delete msg.url;
        }
    }
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