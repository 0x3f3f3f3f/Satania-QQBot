const PixivAppApi = require('pixiv-app-api');
const pixivImg = require("pixiv-img");
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
sharp.cache(false);
const _ = require('lodash');

// 初始化pixiv-app-api
const pixiv = new PixivAppApi(secret.PixivUserName, secret.PixivPassword, {
    camelcaseKeys: true
});

const groupList = JSON.parse(fs.readFileSync('./protocols/PixivPic_group_list.json', 'utf8'));

let isInitialized = false;

process.nextTick(async () => {
    setuClear();
    // 登录pixiv
    await pixiv.login();
    console.log('pixiv logged');

    await setuPull();

    isInitialized = true;
});

// 计时器 每秒执行一次
// 当前小时
let curHours = new Date().getHours();
// 色图技能充能
const setuMaxCharge = 5;
const setuCD = 120;
const setuCharge = {};
const timer = setInterval(() => {
    const curDate = new Date();
    if (curHours != curDate.getHours()) {
        curHours = curDate.getHours();
        pixiv.login();
        // 每天12点清理色图缓存、更新色图库
        if (curHours == 12) {
            setuShown = [];
            fs.writeFileSync('setuShown.txt', '');
            setuClear();
            setuPull();
        }
    }
    // 充能（区分每个群）
    for (const groupId in setuCharge) {
        const charge = setuCharge[groupId];
        if (charge.count < setuMaxCharge) {
            charge.cd--;
            if (charge.cd == 0) {
                charge.cd = setuCD;
                charge.count++;
            }
        }
    }
}, 1000);

let setuPool = [];

async function setuPull() {
    const illusts = [];

    try {
        illusts.push(...(await pixiv.illustRanking({
            mode: 'day_male'
        })).illusts);
        while (pixiv.hasNext()) {
            illusts.push(...(await pixiv.next()).illusts);
        }
    } catch {
        return;
    }

    const results = [];
    for (let i = 0; i < illusts.length; i++) {
        const illust = illusts[i];
        if (i < 10) console.log(illust.title);
        if (testIllust(illust)) {
            results.push(illust);
        }
    }

    if (results) {
        setuPool = results;
        console.log('已拉取色图库', setuPool.length);
    } else {
        console.error('色图库拉取失败');
    }
}

const sexualityRegExp = new RegExp([
    '着',
    '乳',
    'おっぱい',
    '魅惑',
    'タイツ',
    'スト',
    '足',
    '尻',
    'ぱんつ',
    '(^|,)パンツ($|,)',
    'パンチラ',
    '縛',
    '束',
    'ロリ',
    '幼女',
    '獣耳',
    '男の娘',
    'ちんちんの付いた美少女'
].join('|'));

function testIllust(illust) {
    if (illust.type != 'illust') return false;
    let tags = ''
    for (const tag of illust.tags) {
        tags += tags ? (',' + tag.name) : tag.name;
    }
    if (/r-18/i.test(tags)) return false;
    if (sexualityRegExp.test(tags)) return true;
    return false;
}

async function setuDownload(regExp = null) {
    if (setuPool.length == 0) return null;

    let setuIndex;

    if (regExp) {
        const indexes = [];
        for (let i = 0; i < setuPool.length; i++) {
            const illust = setuPool[i];
            let tags = ''
            for (const tag of illust.tags) {
                tags += tags ? (',' + tag.name) : tag.name;
            }
            if (regExp.test(tags)) {
                indexes.push(i);
            }
        }
        if (!_.isEmpty(indexes)) {
            setuIndex = indexes[parseInt(Math.random() * indexes.length)];
        } else return null;
    } else {
        const indexes = [];
        for (let i = 0; i < setuPool.length; i++) {
            const illust = setuPool[i];
            if (illust.totalBookmarks > 1000) {
                indexes.push(i);
            }
        }
        if (!_.isEmpty(indexes)) {
            setuIndex = indexes[parseInt(Math.random() * indexes.length)];
        } else return null;
    }

    const illust = setuPool[setuIndex];

    let nextIllust;

    try {
        let illusts = [];
        illusts = (await pixiv.illustRelated(illust.id)).illusts;
        while (!nextIllust) {
            for (const Illust2 of illusts) {
                if (testIllust(Illust2) && !isShown(Illust2.id)) {
                    nextIllust = Illust2;
                    break;
                }
            }
            if (nextIllust || !pixiv.hasNext()) break;
            illusts = (await pixiv.next()).illusts;
        }
    } catch {
        return setuDownload(regExp);
    }

    try {
        if (isShown(illust.id)) {
            if (nextIllust) {
                setuPool[setuIndex] = nextIllust;
            } else {
                setuPool.splice(setuIndex, 1);
            }
            return setuDownload(regExp);
        } else {
            const url = illust.imageUrls.large.match(/^http.*?\.net|img-master.*$/g).join('/');
            const setuPath = path.join(secret.tempPath, 'image', 'setu_' + path.basename(url));
            await pixivImg(url, setuPath);
            setuShown.push(illust.id.toString());
            fs.appendFileSync('setuShown.txt', illust.id + '\n');
            const sourceImg = sharp(setuPath);
            const sourceImgMetadata = await sourceImg.metadata();
            const waterMarkImg = sharp('watermark.png');
            const waterMarkImgMetadata = await waterMarkImg.metadata();
            const x = sourceImgMetadata.width - waterMarkImgMetadata.width - (parseInt(Math.random() * 5) + 6);
            const y = sourceImgMetadata.height - waterMarkImgMetadata.height - (parseInt(Math.random() * 5) + 6);
            const watermarkBuffer = await waterMarkImg.extract({
                left: x < 0 ? -x : 0,
                top: y < 0 ? -y : 0,
                width: x < 0 ? waterMarkImgMetadata.width + x : waterMarkImgMetadata.width,
                height: y < 0 ? waterMarkImgMetadata.height + y : waterMarkImgMetadata.height
            }).toBuffer();
            const imgBuffer = await sourceImg.composite([{
                input: watermarkBuffer,
                left: x < 0 ? 0 : x,
                top: y < 0 ? 0 : y
            }]).toBuffer();
            fs.writeFileSync(setuPath, imgBuffer);
            if (nextIllust) {
                setuPool[setuIndex] = nextIllust;
            } else {
                setuPool.splice(setuIndex, 1);
            }
            return setuPath;
        }
    } catch {
        return setuDownload(regExp);
    }
}

function setuClear() {
    const setuDir = fs.readdirSync(path.join(secret.tempPath, 'image'));
    for (const setuPath of setuDir) {
        fs.unlinkSync(path.join(secret.tempPath, 'image', setuPath));
    }
}

let setuShown = [];
for (let setuID of fs.readFileSync('setuShown.txt', 'utf8').split('\n')) {
    setuID = setuID.trim();
    if (setuID != '')
        setuShown.push(setuID);
}

function isShown(id) {
    if (setuShown.indexOf(id.toString()) != -1) return true;
    return false;
}

module.exports = function (recvObj, client) {
    // 群黑名单
    if (groupList.block.indexOf(recvObj.group.toString()) != -1) {
        return false;
    }

    // 胸
    if (/奶|乳|胸|欧派/m.test(recvObj.content)) {
        PixivPic(recvObj, client, new RegExp('乳|おっぱい|魅惑の谷間', 'm'));
        return true;
    }
    // 黑丝
    else if (/黑丝/m.test(recvObj.content)) {
        PixivPic(recvObj, client, new RegExp('黒スト|黒タイツ', 'm'));
        return true;
    }
    // 白丝
    else if (/白丝/m.test(recvObj.content)) {
        PixivPic(recvObj, client, new RegExp('白スト|白タイツ', 'm'));
        return true;
    }
    // 其他丝袜
    else if (/袜/m.test(recvObj.content)) {
        PixivPic(recvObj, client, new RegExp('ストッキング|タイツ', 'm'));
        return true;
    }
    // 大腿
    else if (/腿/m.test(recvObj.content)) {
        PixivPic(recvObj, client, new RegExp('魅惑のふともも', 'm'));
        return true;
    }
    // 臀
    else if (/屁股|臀|屁屁/m.test(recvObj.content)) {
        PixivPic(recvObj, client, new RegExp('尻', 'm'));
        return true;
    }
    // 足
    else if (/足|脚|jio/im.test(recvObj.content)) {
        PixivPic(recvObj, client, new RegExp('足', 'm'));
        return true;
    }
    // 胖次
    else if (/胖次|内裤|小裤裤/im.test(recvObj.content)) {
        PixivPic(recvObj, client, new RegExp('ぱんつ|パンツ|パンチラ', 'm'));
        return true;
    }
    // 拘束
    else if (/拘|束|捆|绑|缚/m.test(recvObj.content)) {
        PixivPic(recvObj, client, new RegExp('拘束|緊縛', 'm'));
        return true;
    }
    // 萝莉
    else if (/萝莉|幼女|炼铜/m.test(recvObj.content)) {
        PixivPic(recvObj, client, new RegExp('ロリ|幼女', 'm'));
        return true;
    }
    // 兽耳
    else if (/兽耳|兽娘/m.test(recvObj.content)) {
        PixivPic(recvObj, client, new RegExp('獣耳', 'm'));
        return true;
    }
    // 伪娘
    else if (/伪娘|女装|铝装|可爱的男|带把/m.test(recvObj.content)) {
        PixivPic(recvObj, client, new RegExp('男の娘|ちんちんの付いた美少女', 'm'));
        return true;
    } else if (/(色|涩|瑟).*?图|gkd|搞快点|开车|不够(色|涩|瑟)/im.test(recvObj.content)) {
        PixivPic(recvObj, client);
        return true;
    }
    return false;
}

async function PixivPic(recvObj, client, regExp = null) {
    if (!isInitialized) {
        client.sendMsg(recvObj, '萨塔尼亚还没准备好~');
        return;
    }

    if (!setuCharge[recvObj.group]) {
        setuCharge[recvObj.group] = {
            count: setuMaxCharge,
            cd: setuCD
        }
    }
    // 白名单
    if (groupList.white.indexOf(recvObj.group.toString()) != -1) {
        setuCharge[recvObj.group].count = 99;
    }

    if (setuCharge[recvObj.group].count == 0) {
        client.sendMsg(recvObj, '搞太快了~ 请等待' +
            (parseInt(setuCharge[recvObj.group].cd / 60) == 0 ? '' : (parseInt(setuCharge[recvObj.group].cd / 60) + '分')) +
            setuCharge[recvObj.group].cd % 60 + '秒'
        );
        return;
    }

    let setuPath;
    try {
        setuPath = await setuDownload(regExp);
    } catch {}

    if (setuPath) {
        setuCharge[recvObj.group].count--;
        client.sendMsg(recvObj, `[QQ:pic=${setuPath}]`);
    } else {
        client.sendMsg(recvObj, `[QQ:pic=${secret.emoticonsPath}\\satania_cry.gif]`);
    }
}