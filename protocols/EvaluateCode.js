const request = require('request');

module.exports = function (recvObj, client) {
    if (/(运行|执行|跑)c#|c#(运行|执行)/ig.test(recvObj.content)) {
        const code = recvObj.content.replace(/\[.*?\]|(运行|执行|跑)c#|c#(运行|执行)/ig, '')
            .replace(/\\r/, '\r').replace(/\\n/g, '\n');

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
    } catch {
        client.sendMsg(recvObj, '欧尼酱执行C#服务出错了~喵');
        return;
    }

    client.sendMsg(recvObj, `[QQ:at=${recvObj.qq}]\r\n` + result.output);
}