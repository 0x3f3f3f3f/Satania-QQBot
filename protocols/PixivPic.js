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

const tagList = JSON.parse(fs.readFileSync('./protocols/Pixiv_tags.json', 'utf8'));

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
}

let isInitialized = false;

(async function () {
    cleanUp();
    // 初始化数据库
    await initDatabase();

    isInitialized = true;
})();

// 计时器 每秒执行一次
// 当前小时
let curHours = moment().hours();
// 色图技能充能
const illustMaxCharge = 5;
const illustCD = 120;
const illustCharge = {};
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
            if (charge.cd == 0) {
                charge.cd = illustCD;
                charge.count++;
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

function updateIllusts() {
    childProcess.fork('Pixiv_database.js', [tagList.sexTags.join() + ',' + tagList.charTags.join(), 'day', 0, 0, 7]);
}

async function searchIllust(recvObj, tags, opt) {
    let illustsQuery;
    let illust;

    if (tags) {
        let stringQuery = '';
        for (const tag of tags) {
            switch (tag) {
                case '|':
                    stringQuery += ' or ';
                    break;
                case '&':
                    stringQuery += ' and ';
                    break;
                default:
                    stringQuery += stringQuery ? `\`tags\` like \'%${tag}%\'` : `(\`tags\` like \'%${tag}%\'`;
                    break;
            }
        }
        if (recvObj.type != recvType.friend) {
            stringQuery = '\`rating\` not like \'r18%\' and ' + stringQuery;
        }
        stringQuery += ')';
        illustsQuery = knex('illusts').whereRaw(stringQuery);
    } else {
        if (recvObj.type == recvType.friend) {
            illustsQuery = knex('illusts');
        } else {
            illustsQuery = knex('illusts').where('rating', 'not like', 'r18%')
        }
    }
    if (!opt.resend) {
        if ((
                recvObj.type == recvType.friend ||
                recvObj.type == recvType.groupNonFriend ||
                recvObj.type == recvType.discussNonFriend ||
                recvObj.type == recvType.nonFriend
            ) && opt.num > 1000) {
            illustsQuery.where('total_bookmarks', '>=', opt.num);
        } else {
            const rand = 1 - Math.pow(1 - Math.random(), 2) * 20000;
            if (rand > 1000)
                illustsQuery.where('total_bookmarks', '>=', rand);
        }
    }

    if (!(
            recvObj.type == recvType.friend ||
            recvObj.type == recvType.groupNonFriend ||
            recvObj.type == recvType.discussNonFriend ||
            recvObj.type == recvType.nonFriend
        ) && recvObj != '') {
        if (opt.resend) {
            illust = (await knex('illusts')
                .whereExists(
                    knex.from(knex('seen_list').where('group', recvObj.group).orderBy('id', 'desc').limit(1).offset(opt.num - 1).as('seen'))
                    .whereRaw('illusts.id = seen.illust_id')
                ))[0];
        } else {
            illustsQuery.as('illusts');
            const curQuery = knex.from(illustsQuery)
                .whereNotIn(
                    'id',
                    knex.select('illust_id as id').from('seen_list').where('group', recvObj.group)
                )
            const count = (await curQuery.clone().count('* as count'))[0].count;
            const rand = 1 - Math.pow(1 - Math.random(), 2);
            illust = (await curQuery.limit(1).offset(parseInt(rand * count)))[0];
        }
    } else {
        const count = (await illustsQuery.clone().count('* as count'))[0].count;
        const rand = 1 - Math.pow(1 - Math.random(), 2);
        illust = (await illustsQuery.limit(1).offset(parseInt(rand * count)))[0];
    }

    if (!illust) return null;

    console.log('PixivPic:', illust.id, illust.title, moment(illust.create_date).format('YYYY-MM-DD, H:mm:ss'));

    // 没给标签也没有命中性癖标签，需要重新找一次
    if (!tags && !(new RegExp(tagList.sexTags.join('|')).test(illust.tags))) {
        return searchIllust(recvObj, tags, opt);
    }

    return illust;
}

async function downloadIllust(illust, recvObj, opt) {
    try {
        const illustPath = path.join(secret.tempPath, 'image', 'illust_' + path.basename(illust.image_url));
        await pixivImg(illust.image_url, illustPath);
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
                quality: 100,
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
            return false;
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
            await PixivPic(recvObj, client, tags, opt);
        }
        return;
    }

    if (!isInitialized) {
        client.sendMsg(recvObj, '萨塔尼亚还没准备好~');
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