const nzhcn = require('nzh/cn');
const path = require('path');

module.exports = function (recvObj, client) {
    if (/roll/im.test(recvObj.content)) {
        const msg = recvObj.content.replace(/\[.*?\]/g, '').trim();
        const num = msg.match(/\d+/g);
        const numZh = msg.match(/[零一二两三四五六七八九十百千万亿兆]+/g);
        if (num) {
            if (num.length == 1) {
                const num2 = parseInt(num[0]);
                client.sendMsg(recvObj, `[QQ:at=${recvObj.qq}]\r\n` + `roll(1-${num2}): ${parseInt(Math.random() * num2) + 1}`);
            } else if (num.length >= 2) {
                const num1 = parseInt(num[0]);
                const num2 = parseInt(num[1]);
                client.sendMsg(recvObj, `[QQ:at=${recvObj.qq}]\r\n` + `roll(${num1}-${num2}): ${num1 + parseInt(Math.random() * ((num2 + 1) - num1))}`);
            }
        } else if (numZh) {
            if (numZh.length == 1) {
                const num2 = parseInt(nzhcn.decodeS(numZh[0].replace(/两/g, '二')));
                client.sendMsg(recvObj, `[QQ:at=${recvObj.qq}]\r\n` + `roll(1-${num2}): ${parseInt(Math.random() * num2) + 1}`);
            } else if (numZh.length >= 2) {
                const num1 = parseInt(nzhcn.decodeS(numZh[0].replace(/两/g, '二')));
                const num2 = parseInt(nzhcn.decodeS(numZh[1].replace(/两/g, '二')));
                client.sendMsg(recvObj, `[QQ:at=${recvObj.qq}]\r\n` + `roll(${num1}-${num2}): ${num1 + parseInt(Math.random() * ((num2 + 1) - num1))}`);
            }
        } else {
            client.sendMsg(recvObj, `[QQ:at=${recvObj.qq}]\r\n` + `roll(1-100): ${parseInt(Math.random() * 100) + 1}`);
        }
        return true;
    } else if (/(抛|投)骰子/m.test(recvObj.content)) {
        client.sendMsg(recvObj, `[QQ:at=${recvObj.qq}]\r\n` + `[QQ:pic=${secret.emoticonsPath}${path.sep}dice_${parseInt(Math.random() * 6) + 1}.gif]`);
        return true;
    }

    return false;
}