const path = require('path');

module.exports = function (recvObj, client) {
    // 确认消息是否为分享卡片
    if (/^<\?xml/i.test(recvObj.content)) {
        // 是逼站app分享
        if (/source\s+name="哔哩哔哩"/i.test(recvObj.content)) {
            client.sendMsg(recvObj, `[CQ:image,file=${secret.emoticonsPath}${path.sep}anti_bili_mini_app.png]`);
            return true;
        }
    }
    return false;
}