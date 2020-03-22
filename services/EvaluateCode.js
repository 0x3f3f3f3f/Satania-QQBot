const request = require('request');

module.exports = function (req, res) {
    request.post(secret.evaluateCodeUrl, {
        json: req.body
    }, (err, res2, body) => {
        if (err) {
            res.json({
                output: '执行C#服务离线了！'
            });
        }
        res.json(body);
    });
}