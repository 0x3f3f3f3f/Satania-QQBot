const pixivImg = require("pixiv-img");
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
sharp.cache(false);
const _ = require('lodash');
const childProcess = require('child_process');
const moment = require('moment');
const nzhcn = require('nzh/cn');
const recvType = require('../lib/receiveType');
const base64url = require('../lib/base64url');

// 连接数据库
const knex = require('knex')({
    client: 'mysql2',
    connection: {
        host: secret.mysqlHost,
        user: secret.mysqlUser,
        password: secret.mysqlPassword,
        database: secret.mysqlDatabase
    }
});

async function initDatabase() {
    if (!(await knex.schema.hasTable('seen_list'))) {
        await knex.schema.createTable('seen_list', table => {
            table.increments('id').primary();
        });
    }
    if (!(await knex.schema.hasTable('rule_list'))) {
        await knex.schema.createTable('rule_list', table => {
            table.increments('id').primary();
        });
    }
    if (!(await knex.schema.hasTable('inside_tags'))) {
        await knex.schema.createTable('inside_tags', table => {
            table.increments('id').primary();
        });
    }

    if (!(await knex.schema.hasColumn('seen_list', 'group'))) {
        await knex.schema.table('seen_list', table => {
            table.string('group').index('group');
        });
    }
    if (!(await knex.schema.hasColumn('seen_list', 'illust_id'))) {
        await knex.schema.table('seen_list', table => {
            table.integer('illust_id').index('illust_id').unsigned();
        });
    }
    if (!(await knex.schema.hasColumn('seen_list', 'date'))) {
        await knex.schema.table('seen_list', table => {
            table.dateTime('date');
        });
    }
    if (!(await knex.schema.hasColumn('rule_list', 'type'))) {
        await knex.schema.table('rule_list', table => {
            table.string('type').index('type');
        });
    }
    if (!(await knex.schema.hasColumn('rule_list', 'name'))) {
        await knex.schema.table('rule_list', table => {
            table.string('name').index('name');
        });
    }
    if (!(await knex.schema.hasColumn('rule_list', 'rule'))) {
        await knex.schema.table('rule_list', table => {
            table.string('rule').index('rule');
        });
    }
    if (!(await knex.schema.hasColumn('inside_tags', 'type'))) {
        await knex.schema.table('inside_tags', table => {
            table.string('type').index('type');
        });
    }
    if (!(await knex.schema.hasColumn('inside_tags', 'tag'))) {
        await knex.schema.table('inside_tags', table => {
            table.string('tag');
        });
    }
    if (!(await knex.schema.hasColumn('inside_tags', 'comment'))) {
        await knex.schema.table('inside_tags', table => {
            table.string('comment').defaultTo('');
        });
    }
}

const tagList = {};
let illusts = [];
let illustsIndex = {};

let isInitialized = false;

(async function () {
    cleanUp();
    // 初始化数据库
    await initDatabase();
    // 拿到内部标签
    await getInsideTags();
    // 把数据库灌入内存
    await getIllusts();

    isInitialized = true;
})();

// 计时器 每秒执行一次
// 当前小时
let curHours = moment().hours();
// 色图技能充能
const illustMaxCharge = 5;
const illustCD = 120;
const illustCharge = {};
const illustBlockMaxCharge = 100;
const illustBlockCD = 3600;
const illustBlock = {};
const timer = setInterval(() => {
    const curMoment = moment();
    if (curHours != curMoment.hours()) {
        curHours = curMoment.hours();
        //清理色图缓存
        cleanUp();
        // 每天12点更新色图库
        if (curHours == 12) {
            updateIllusts();
        }
    }
    // 充能（区分每个群）
    for (const groupId in illustCharge) {
        const charge = illustCharge[groupId];
        if (charge.count < illustMaxCharge) {
            charge.cd--;
            if (charge.cd <= 0) {
                charge.cd = illustCD;
                charge.count++;
            }
        }
    }
    // 自动ban
    for (const qq in illustBlock) {
        const charge = illustBlock[qq];
        if (charge.count < illustBlockMaxCharge) {
            charge.cd--;
            if (charge.cd <= 0) {
                delete illustBlock[qq];
            }
        }
    }
}, 1000);

function cleanUp() {
    const illustDir = fs.readdirSync(path.join(secret.tempPath, 'image'));
    for (const illustPath of illustDir) {
        fs.unlinkSync(path.join(secret.tempPath, 'image', illustPath));
    }
}

function replaceRegexpChar(tag) {
    return tag.replace(/(?=[\(\)\=])/g, '\\');
}

async function getInsideTags() {
    const insideTags = await knex('inside_tags').select('type', 'tag');
    for (const insideTag of insideTags) {
        if (!_.isArray(tagList[insideTag.type])) tagList[insideTag.type] = [];
        tagList[insideTag.type].push(insideTag.tag);
    }
}

async function getIllusts() {
    illusts = await knex('illusts').select('id', 'title as ti', 'image_url as url', 'rating as r', 'tags as t', 'create_date as d', 'total_bookmarks as b').orderBy('id', 'asc');
    illustsIndex = {};
    for (let i = 0; i < illusts.length; i++) {
        illustsIndex[illusts[i].id] = i;
    }
}

async function updateIllusts() {
    await getInsideTags();
    const js1 = childProcess.fork('Pixiv_database.js', [tagList.sex.join(), 'day_sex', 0, 0, 7]);
    const js2 = childProcess.fork('Pixiv_database.js', [tagList.char.join(), 'day_char', 0, 0, 7]);
    await Promise.all([
        new Promise(resolve => js1.on('close', resolve)),
        new Promise(resolve => js2.on('close', resolve))
    ]);
    await getIllusts();
}

async function searchIllust(recvObj, tags, opt) {
    const selected = [];
    const selectedIndex = {};
    let startTime = Date.now();

    let bookmarks = 1000;
    if ((
            recvObj.type == recvType.friend ||
            recvObj.type == recvType.groupNonFriend ||
            recvObj.type == recvType.discussNonFriend ||
            recvObj.type == recvType.nonFriend
        ) && opt.num > bookmarks) {
        bookmarks = opt.num;
    } else {
        const rand = (1 - Math.pow(1 - Math.random(), 2)) * 20000;
        if (rand > bookmarks) {
            bookmarks = rand;
        }
    }
    const isSafe = recvObj.type != recvType.friend;

    function selectTags() {
        let opAnd = [];
        const opOr = [];
        for (let i = 0; i < tags.length; i++) {
            const tag = tags[i];
            switch (tag) {
                case '|':
                    opOr.push(opAnd);
                    opAnd = [];
                    break;
                case '&':
                    break;
                default:
                    opAnd.push(tag);
                    break;
            }
        }
        opOr.push(opAnd);

        for (const illust of illusts) {
            if (illust.b < bookmarks) continue;
            if (isSafe && illust.r != 'safe') continue;
            for (const inAnd of opOr) {
                let lastBool = true;
                for (const and of inAnd) {
                    if (illust.t.indexOf(and) == -1) {
                        lastBool = false;
                        break;
                    }
                }
                if (lastBool) {
                    selected.push(illustsIndex[illust.id]);
                    selectedIndex[illust.id] = selected.length - 1;
                    break;
                }
            }
        }
    }

    function selectAll() {
        const regExp = new RegExp(tagList.sex.join('|'), 'im');
        for (const illust of illusts) {
            if (illust.b < bookmarks) continue;
            if (isSafe && illust.r != 'safe') continue;
            if (!tags && !(regExp.test(illust.t))) {
                selected.push(illustsIndex[illust.id]);
                selectedIndex[illust.id] = selected.length - 1;
            }
        }
    }

    if (opt.resend) {
        if (!(
                recvObj.type == recvType.friend ||
                recvObj.type == recvType.groupNonFriend ||
                recvObj.type == recvType.discussNonFriend ||
                recvObj.type == recvType.nonFriend
            ) && recvObj.group != '') {
            const seen = (await knex('seen_list').where('group', recvObj.group).select('id', 'illust_id').orderBy('id', 'desc').limit(1).offset(opt.num - 1))[0];
            if (!_.isEmpty(seen)) {
                return illusts[illustsIndex[seen.illust_id]];
            } else {
                return null;
            }
        } else {
            selectAll();
        }
    } else {
        if (tags) {
            selectTags();
        } else {
            selectAll();
        }
    }

    if (!(
            recvObj.type == recvType.friend ||
            recvObj.type == recvType.groupNonFriend ||
            recvObj.type == recvType.discussNonFriend ||
            recvObj.type == recvType.nonFriend
        ) && recvObj.group != '') {
        const seenList = await knex('seen_list').where('group', recvObj.group).select('illust_id as id').orderBy('id', 'desc');
        for (const seen of seenList) {
            if (!_.isUndefined(selectedIndex[seen.id])) {
                selected.splice(selectedIndex[seen.id], 1);
            }
        }
    }

    const count = selected.length;
    const rand = (1 - Math.pow(1 - Math.random(), 2)) * count;
    const illust = illusts[selected[parseInt(rand)]];

    console.log('Query time:', (Date.now() - startTime) + 'ms');

    if (!illust) return null;

    console.log('PixivPic:', illust.id, illust.ti, moment(illust.d).format('YYYY-MM-DD, H:mm:ss'));

    return illust;
}

async function downloadIllust(illust, recvObj, opt) {
    try {
        const illustPath = path.join(secret.tempPath, 'image', 'illust_' + path.basename(illust.url));
        await pixivImg(illust.url, illustPath);
        if (!opt.resend && !(
                recvObj.type == recvType.friend ||
                recvObj.type == recvType.groupNonFriend ||
                recvObj.type == recvType.discussNonFriend ||
                recvObj.type == recvType.nonFriend
            ) && recvObj.group != '') {
            await knex('seen_list').insert({
                group: recvObj.group,
                illust_id: illust.id,
                date: moment().format()
            });
        }
        const sourceImg = sharp(illustPath);
        const sourceImgMetadata = await sourceImg.metadata();
        const waterMarkImg = sharp('watermark.png');
        const waterMarkImgMetadata = await waterMarkImg.metadata();
        const x = sourceImgMetadata.width - waterMarkImgMetadata.width - (parseInt(Math.random() * 5) + 6);
        const y = sourceImgMetadata.height - waterMarkImgMetadata.height - (parseInt(Math.random() * 5) + 6);
        const waterMarkBuffer = await waterMarkImg.extract({
            left: x < 0 ? -x : 0,
            top: y < 0 ? -y : 0,
            width: x < 0 ? waterMarkImgMetadata.width + x : waterMarkImgMetadata.width,
            height: y < 0 ? waterMarkImgMetadata.height + y : waterMarkImgMetadata.height
        }).toBuffer();
        const imgBuffer = await sourceImg
            .composite([{
                input: waterMarkBuffer,
                left: x < 0 ? 0 : x,
                top: y < 0 ? 0 : y
            }])
            .jpeg({
                quality: 92,
                chromaSubsampling: '4:4:4'
            })
            .toBuffer();
        fs.writeFileSync(illustPath, imgBuffer);
        return illustPath;
    } catch {
        return null
    }
}

module.exports = async function (recvObj, client) {
    // 群、qq黑名单
    if (
        recvObj.type == recvType.friend ||
        recvObj.type == recvType.groupNonFriend ||
        recvObj.type == recvType.discussNonFriend ||
        recvObj.type == recvType.nonFriend
    ) {
        const rule = (await knex('rule_list').where({
            type: 'qq',
            name: recvObj.qq,
            rule: 'block'
        }))[0];
        if (rule && rule.name == recvObj.qq.toString()) {
            client.sendMsg(recvObj, '您的色图功能已被禁用，如有疑问请联系QQ：23458057');
            return true;
        }
    } else {
        const rule = (await knex('rule_list').where({
            type: 'group',
            name: recvObj.group,
            rule: 'block'
        }))[0];
        if (rule && rule.group == recvObj.group.toString()) {
            return false;
        }
    }

    // 色图计数
    if (/((色|涩|瑟)图|图库)计数|总(数|计)/m.test(recvObj.content)) {
        client.sendMsg(recvObj, '图库总计: ' + (await knex('illusts').where('rating', 'not like', 'r18%').count('* as count'))[0].count + '张');
        return true;
    }

    // 生成web服务的url
    if (/编辑标签/m.test(recvObj.content)) {
        if (
            recvObj.type == recvType.friend ||
            recvObj.type == recvType.groupNonFriend ||
            recvObj.type == recvType.discussNonFriend ||
            recvObj.type == recvType.nonFriend
        ) {
            const account = 'qq:' + recvObj.qq;
            if (!(await knex('users').where('account', account))[0]) {
                await knex('users').insert({
                    account,
                    group: 'user'
                });
            }
            const key = base64url.encode(Buffer.from(account, 'utf-8').toString('base64'));
            client.sendMsg(recvObj,
                '请登录：' + encodeURI(`${secret.publicDomainName}/user-tags/login.html?key=${key}`)
            );
        } else {
            client.sendMsg(recvObj, '欧尼酱~请按下图方法与我私聊获得链接~\r\n' +
                `[QQ:pic=${secret.emoticonsPath}\\user_tags_help.jpg]`);
        }
        return true;
    }

    // 获取数字
    let num; {
        const msg = recvObj.content.replace(/\[.*?\]/g, '').trim();
        num = parseInt(msg.match(/\d+/));
        if (!num) {
            const numZh = msg.match(/[零一二两三四五六七八九十百千万亿兆]+/);
            if (numZh)
                num = parseInt(nzhcn.decodeS(numZh.toString().replace(/两/g, '二')));
        }
    }
    // 重发
    if (/(重|重新|再)发/m.test(recvObj.content)) {
        PixivPic(recvObj, client, null, {
            resend: true,
            num: num || 1
        });
        return true;
    }
    // 十连or三连
    let autoBurst = false;
    let burstNum = 0;
    if ((
            recvObj.type == recvType.friend ||
            recvObj.type == recvType.groupNonFriend ||
            recvObj.type == recvType.discussNonFriend ||
            recvObj.type == recvType.nonFriend
        ) &&
        /(十|10)连/m.test(recvObj.content)) {
        autoBurst = true;
        burstNum = 10;
    } else if (/(三|3)连/m.test(recvObj.content)) {
        autoBurst = true;
        burstNum = 3;
    }

    // 匹配性癖标签
    const userTags = await knex('user_tags').where('enabled', true).select('type', 'match', 'raw_tags as rawTags');
    for (let i = userTags.length - 1; i >= 0; i--) {
        const userTag = userTags[i];
        let regExp;
        if (userTag.type == 'regexp') {
            regExp = new RegExp(userTag.match, 'im');
        } else {
            regExp = new RegExp(userTag.match.split(',').join('|'), 'im')
        }
        if (regExp.test(recvObj.content)) {
            PixivPic(recvObj, client, userTag.rawTags.split(','), {
                autoBurst,
                burstNum,
                num
            });
            return true;
        }
    }

    // Fallback
    if (/(色|涩|瑟)图|gkd|搞快点|开车|不够(色|涩|瑟)/im.test(recvObj.content)) {
        PixivPic(recvObj, client, null, {
            autoBurst,
            burstNum,
            num
        });
        return true;
    }

    return false;
}

async function PixivPic(recvObj, client, tags, opt) {
    // N连抽
    if (opt.autoBurst) {
        opt.autoBurst = false;
        for (let i = 0; i < opt.burstNum; i++) {
            PixivPic(recvObj, client, tags, opt);
        }
        return;
    }

    if (!isInitialized) {
        client.sendMsg(recvObj, '萨塔尼亚还没准备好~');
        return;
    }

    if (!illustBlock[recvObj.qq]) {
        illustBlock[recvObj.qq] = {
            count: illustBlockMaxCharge,
            cd: illustBlockCD
        }
    }

    illustBlock[recvObj.qq].count--;
    if (illustBlock[recvObj.qq].count <= 0) {
        if (!(await knex('rule_list').where('type', 'qq').andWhere('name', recvObj.qq))[0]) {
            await knex('rule_list').insert({
                type: 'qq',
                name: recvObj.qq,
                rule: 'block'
            });
        } else {
            await knex('rule_list').where('type', 'qq').andWhere('name', recvObj.qq).update('rule', 'block');
        }
        delete illustBlock[recvObj.qq];
        return;
    }

    if (!illustCharge[recvObj.group]) {
        illustCharge[recvObj.group] = {
            count: illustMaxCharge,
            cd: illustCD
        }
    }
    // 白名单
    if (!(
            recvObj.type == recvType.friend ||
            recvObj.type == recvType.groupNonFriend ||
            recvObj.type == recvType.discussNonFriend ||
            recvObj.type == recvType.nonFriend
        )) {
        const rule = (await knex('rule_list').where({
            type: 'group',
            name: recvObj.group,
            rule: 'white'
        }))[0];
        if (!(rule && rule.name == recvObj.group.toString())) {
            if (illustCharge[recvObj.group].count <= 0 && !opt.resend) {
                client.sendMsg(recvObj, '搞太快了~ 请等待' +
                    (parseInt(illustCharge[recvObj.group].cd / 60) == 0 ? '' : (parseInt(illustCharge[recvObj.group].cd / 60) + '分')) +
                    illustCharge[recvObj.group].cd % 60 + '秒'
                );
                return;
            }
        }
    }

    let illustPath;
    try {
        const illust = await searchIllust(recvObj, tags, opt);
        if (!illust) throw 'illust is null';
        illustPath = await downloadIllust(illust, recvObj, opt);
    } catch {}

    if (illustPath) {
        // 群聊才减充能
        if (!(
                recvObj.type == recvType.friend ||
                recvObj.type == recvType.groupNonFriend ||
                recvObj.type == recvType.discussNonFriend ||
                recvObj.type == recvType.nonFriend
            ) && !opt.resend) {
            illustCharge[recvObj.group].count--;
        }
        client.sendMsg(recvObj, `[QQ:pic=${illustPath}]`);
    } else {
        client.sendMsg(recvObj, `[QQ:pic=${secret.emoticonsPath}\\satania_cry.gif]`);
    }
}