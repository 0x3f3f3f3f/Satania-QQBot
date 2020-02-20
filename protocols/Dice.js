const nzhcn = require('nzh/cn');
const path = require('path');

module.exports = function (recvObj, client) {
    const msg = recvObj.content.replace(/\[.*?\]/g, '').trim();
    if (/roll/im.test(recvObj.content)) {
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
    } else if (/(抛|投)*?骰子/m.test(recvObj.content)) {
        let num = parseInt(msg.match(/\d+/));
        if (!num) {
            const numZh = msg.match(/[零一二两三四五六七八九十百千万亿兆]+/);
            if (numZh)
                num = parseInt(nzhcn.decodeS(numZh.toString().replace(/两/g, '二')));
        }
        let diceString = '';
        if (num) {
            for (let i = 0; i < Math.min(num, 10); i++) {
                diceString += `[QQ:pic=${secret.emoticonsPath}${path.sep}dice_${parseInt(Math.random() * 6) + 1}.gif]`;
            }
        } else {
            diceString = `[QQ:pic=${secret.emoticonsPath}${path.sep}dice_${parseInt(Math.random() * 6) + 1}.gif]`;
        }
        client.sendMsg(recvObj, `[QQ:at=${recvObj.qq}]\r\n` + diceString);
        return true;
    }

    return false;
}