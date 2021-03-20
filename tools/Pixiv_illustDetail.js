const fs = require('fs');
const _ = require('lodash');

global.secret = JSON.parse(fs.readFileSync('../secret.json', 'utf8'));

const {
    PixivAppApi
} = require('../libs/PixivAppApi');

let pixiv = new PixivAppApi(secret.PixivUserName, secret.PixivToken);

const argIllustId = process.argv[2];

(async function () {
    await pixiv.login();
    if (_.isEmpty(argIllustId)) return console.log('arg0 is empty!');
    const illust = await pixiv.illustDetail(parseInt(argIllustId));
    console.log(JSON.stringify(illust, null, 2));
})();