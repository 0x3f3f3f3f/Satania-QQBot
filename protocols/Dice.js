const nzhcn = require('nzh/cn');
const path = require('path');
const messageHelper = require('../lib/messageHelper');

module.exports = function (recvObj) {
    const inputText = messageHelper.getText(recvObj.message).trim();
    if (/roll/i.test(inputText)) {
        const num = inputText.match(/\d+/g);
        const numZh = inputText.match(/[零一二两三四五六七八九十百千万亿兆]+/g);
        if (num) {
            if (num.length == 1) {
                const num2 = parseInt(num[0]);
                sendMsg(recvObj, [{
                        type: 'At',
                        target: recvObj.qq
                    },
                    {
                        type: 'Plain',
                        text: `\nroll(1-${num2}): ${parseInt(Math.random() * num2) + 1}`
                    },
                ]);
            } else if (num.length >= 2) {
                const num1 = parseInt(num[0]);
                const num2 = parseInt(num[1]);
                sendMsg(recvObj, [{
                        type: 'At',
                        target: recvObj.qq
                    },
                    {
                        type: 'Plain',
                        text: `\nroll(${num1}-${num2}): ${num1 + parseInt(Math.random() * ((num2 + 1) - num1))}`
                    },
                ]);
            }
        } else if (numZh) {
            if (numZh.length == 1) {
                const num2 = parseInt(nzhcn.decodeS(numZh[0].replace(/两/g, '二')));
                sendMsg(recvObj, [{
                        type: 'At',
                        target: recvObj.qq
                    },
                    {
                        type: 'Plain',
                        text: `\nroll(1-${num2}): ${parseInt(Math.random() * num2) + 1}`
                    },
                ]);
            } else if (numZh.length >= 2) {
                const num1 = parseInt(nzhcn.decodeS(numZh[0].replace(/两/g, '二')));
                const num2 = parseInt(nzhcn.decodeS(numZh[1].replace(/两/g, '二')));
                sendMsg(recvObj, [{
                        type: 'At',
                        target: recvObj.qq
                    },
                    {
                        type: 'Plain',
                        text: `\nroll(${num1}-${num2}): ${num1 + parseInt(Math.random() * ((num2 + 1) - num1))}`
                    },
                ]);
            }
        } else {
            sendMsg(recvObj, [{
                    type: 'At',
                    target: recvObj.qq
                },
                {
                    type: 'Plain',
                    text: `\nroll(1-100): ${parseInt(Math.random() * 100) + 1}`
                },
            ]);
        }
        return true;
    } else if (/(抛|投).*?骰子/.test(inputText)) {
        let num = parseInt(inputText.match(/\d+/));
        if (!num) {
            const numZh = inputText.match(/[零一二两三四五六七八九十百千万亿兆]+/);
            if (numZh)
                num = parseInt(nzhcn.decodeS(numZh.toString().replace(/两/g, '二')));
        }
        const diceArr = [];
        if (num) {
            for (let i = 0; i < Math.min(num, 10); i++) {
                diceArr.push({
                    type: 'Image',
                    path: `${secret.emoticonsPath}${path.sep}dice_${parseInt(Math.random() * 6) + 1}.gif`
                });
            }
        } else {
            diceArr.push({
                type: 'Image',
                path: `${secret.emoticonsPath}${path.sep}dice_${parseInt(Math.random() * 6) + 1}.gif`
            });
        }
        sendMsg(recvObj, [{
                type: 'At',
                target: recvObj.qq
            },
            {
                type: 'Plain',
                text: '\n'
            }, ...diceArr
        ]);
        return true;
    }

    return false;
}