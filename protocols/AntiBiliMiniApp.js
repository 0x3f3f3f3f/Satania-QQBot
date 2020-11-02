const path = require('path');
const messageHelper = require('../lib/messageHelper');

module.exports = function (recvObj, client) {
    const inputText = messageHelper.getText(recvObj.message).trim();
    // 确认消息是否为分享卡片
    if (/^<\?xml/i.test(inputText)) {
        // 是逼站app分享
        if (/source\s+name="哔哩哔哩"/i.test(inputText)) {
            sendImage(recvObj, `${secret.emoticonsPath}${path.sep}anti_bili_mini_app.png`);
            return true;
        }
    }
    return false;
}