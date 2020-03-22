const express = require('express');
const _ = require('lodash');
const childProcess = require('child_process');
const path = require('path');

const app = express();
const port = 33200;

app.use(express.json());

app.post('/', async (req, res) => {
    if (!_.isString(req.body.code)) {
        res.json({
            output: "参数不正确"
        });
        return;
    }

    const process = childProcess.spawnSync("dotnet", [
        path.join("CLI", "EvaluateCodeCLI.dll"),
        req.body.code
    ], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000
    });

    const output = process.stdout.trim();

    if (!_.isEmpty(output)) {
        res.json({
            output
        });
    } else {
        res.json({
            output: "执行没有产生结果"
        });
    }
});

app.listen(port);