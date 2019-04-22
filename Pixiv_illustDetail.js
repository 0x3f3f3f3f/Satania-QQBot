const fs = require('fs');
const PixivAppApi = require('pixiv-app-api');
const _ = require('lodash');

const secret = JSON.parse(fs.readFileSync('./secret.json', 'utf8'));

let pixiv = new PixivAppApi(secret.PixivUserName, secret.PixivPassword, {
    camelcaseKeys: true
});

const argIllustId = process.argv[2];

(async function () {
    await pixiv.login();
    if (_.isEmpty(argIllustId)) return console.log('arg0 is empty!');
    const illust = await pixiv.illustDetail(argIllustId);
    console.log(JSON.stringify(illust, null, 2));
})();