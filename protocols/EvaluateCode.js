const request = require('request');
const _ = require('lodash');

module.exports = function (recvObj, client) {
    if (/(运行|执行|跑)c#|c#(运行|执行)/i.test(recvObj.content)) {
        const code = recvObj.content.replace(/\[.*?\]|(运行|执行|跑)c#|c#(运行|执行)/ig, '')
            .replace(/\\r\\n|\\n/g, '\n');

        if (_.isEmpty(code.trim())) {
            client.sendMsg(recvObj, '你居然没写代码？');
            return true;
        }
        EvaluateCode(code, recvObj, client);

        return true;
    }
    return false;
}

async function EvaluateCode(code, recvObj, client) {
    let result;
    try {
        result = await new Promise((resolve, reject) => {
            request.post(`${secret.serviceRootUrl}/service/EvaluateCode`, {
                json: {
                    code
                }
            }, (err, res, body) => {
                if (err) {
                    reject();
                    return;
                }
                resolve(body);
            });
        });

        if (!result.output) {
            client.sendMsg(recvObj, '欧尼酱执行C#服务出错了~喵');
            return;
        }
    } catch {
        client.sendMsg(recvObj, '欧尼酱执行C#服务出错了~喵');
        return;
    }

    client.sendMsg(recvObj, `[QQ:at=${recvObj.qq}]\r\n` + result.output);
}