const _ = require('lodash');
const moment = require('moment');
const nzhcn = require('nzh/cn');
const recvType = require('../lib/receiveType');
const base64url = require('../lib/base64url');
const request = require('request');
const fs = require('fs');
const path = require('path');

// 连接数据库
const knex = require('knex')({
    client: 'mysql2',
    connection: {
        host: secret.mysqlHost,
        port: secret.mysqlPort,
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
const groupBlockMaxCount = 5;
const groupBlockCD = 120;
const groupList = {};
const userBlockMaxCount = 100;
const userBlockCD = 3600;
const userList = {};
const timer = setInterval(() => {
    const curMoment = moment();
    if (curHours != curMoment.hours()) {
        curHours = curMoment.hours();
        //清理色图缓存
        cleanUp();
        // 每天12点更新色图库
        if (curHours == 12) {
            updateIllusts();
            // 重置用户列表
            for (const qq in userList) {
                delete userList[qq];
            }
        }
    }
    // 充能（区分每个群）
    for (const groupId in groupList) {
        const group = groupList[groupId];
        if (group.count < groupBlockMaxCount) {
            group.cd--;
            if (group.cd <= 0) {
                group.cd = groupBlockCD;
                group.count++;
            }
        }
    }
    // 自动ban
    for (const qq in userList) {
        const user = userList[qq];
        if (user.count < userBlockMaxCount) {
            user.cd--;
            if (user.cd <= 0) {
                user.cd = userBlockCD;
                user.count = userBlockMaxCount;
            }
        }
    }
}, 1000);

function cleanUp() {
    const imgDir = fs.readdirSync(path.join(secret.tempPath, 'image'));
    for (const imgPath of imgDir) {
        fs.unlinkSync(path.join(secret.tempPath, 'image', imgPath));
    }
    const voiceDir = fs.readdirSync(path.join(secret.tempPath, 'voice'));
    for (const voicePath of voiceDir) {
        fs.unlinkSync(path.join(secret.tempPath, 'voice', voicePath));
    }
}

function replaceRegexpChar(tag) {
    if (_.isArray(tag)) {
        const ret = [];
        for (const t of tag) {
            ret.push(t.replace(/(?=[\^\$\(\)\[\]\{\}\*\+\.\?\\\|\/])/g, '\\'));
        }
        return ret;
    } else {
        return tag.replace(/(?=[\^\$\(\)\[\]\{\}\*\+\.\?\\\|\/])/g, '\\');
    }
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
    for (const illust of illusts) {
        illust.t = illust.t.toLowerCase();
    }
    illustsIndex = {};
    for (let i = 0; i < illusts.length; i++) {
        illustsIndex[illusts[i].id] = i;
    }
}

async function updateIllusts() {
    await getInsideTags();

    // 发起更新
    try {
        await new Promise((resolve, reject) => {
            request.post(`${secret.serviceRootUrl}/service/PixivPic`, {
                json: {
                    evnt: 'updateIllusts',
                    tagList
                }
            }, (err, res, body) => {
                if (err) {
                    reject();
                    return;
                }
                if (body.result) resolve();
                else reject();
            });
        });
    } catch {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return updateIllusts();
    }

    // 获取更新状态
    let isUpdating = true;
    while (isUpdating) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        isUpdating = await new Promise(resolve => {
            request.post(`${secret.serviceRootUrl}/service/PixivPic`, {
                json: {
                    evnt: 'getStatus'
                }
            }, (err, res, body) => {
                if (!err && _.isBoolean(body.isUpdating)) {
                    resolve(body.isUpdating);
                } else {
                    resolve(true);
                }
            });
        });
    }

    await getIllusts();
}

async function searchIllust(recvObj, tags, opt, seenList) {
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
    let opAnd = [];
    const opOr = [];
    let regExp;

    function selectTags() {
        if (_.isEmpty(opOr)) {
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
        }
        for (const illust of illusts) {
            if (illust.b < bookmarks) continue;
            if (isSafe && illust.r != 'safe') continue;
            for (const inAnd of opOr) {
                let lastBool = true;
                for (let i = 0; i < inAnd.length; i++) {
                    const and = inAnd[i];
                    if (illust.t.indexOf(and) == -1) {
                        lastBool = false;
                        break;
                    }
                }
                if (lastBool) {
                    if (opt.rule && opt.rule.rule == 'safe') {
                        if (!regExp) regExp = new RegExp(replaceRegexpChar(tagList.sex).join('|'), 'i');
                        if (!regExp.test(illust.t)) {
                            selected.push(illustsIndex[illust.id]);
                            selectedIndex[illust.id] = selected.length - 1;
                        }
                    } else {
                        selected.push(illustsIndex[illust.id]);
                        selectedIndex[illust.id] = selected.length - 1;
                    }
                    break;
                }
            }
        }
    }

    function selectAll() {
        if (!regExp) regExp = new RegExp(replaceRegexpChar(tagList.sex).join('|'), 'i');
        for (const illust of illusts) {
            if (illust.b < bookmarks) continue;
            if (isSafe && illust.r != 'safe') continue;
            if (opt.rule && opt.rule.rule == 'safe') {
                if (!regExp.test(illust.t)) {
                    selected.push(illustsIndex[illust.id]);
                    selectedIndex[illust.id] = selected.length - 1;
                }
            } else {
                if (regExp.test(illust.t)) {
                    selected.push(illustsIndex[illust.id]);
                    selectedIndex[illust.id] = selected.length - 1;
                }
            }
        }
    }

    async function rmSeen() {
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
                    delete selectedIndex[seen.id];
                }
            }
        } else {
            seenList.sort((a, b) => b.id - a.id);
            for (const seen of seenList) {
                if (!_.isUndefined(selectedIndex[seen.id])) {
                    selected.splice(selectedIndex[seen.id], 1);
                    delete selectedIndex[seen.id];
                }
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
            await rmSeen();
        } else {
            selectAll();
            await rmSeen();
        }
    }

    if (_.isEmpty(selected) && bookmarks > 1000) {
        bookmarks = 1000;
        if (tags) {
            selectTags();
            await rmSeen();
        } else {
            selectAll();
            await rmSeen();
        }
    }

    let illust;
    if (!_.isEmpty(selected)) {
        const count = selected.length;
        const rand = (1 - Math.pow(1 - Math.random(), 2)) * count;
        illust = illusts[selected[parseInt(rand)]];
    }

    console.log('Query time:', (Date.now() - startTime) + 'ms');

    if (!illust) return null;

    console.log('PixivPic:', illust.id, illust.ti, `bookmarks: ${illust.b}>${parseInt(bookmarks)}`, moment(illust.d).format('YYYY-MM-DD, H:mm:ss'));

    return illust;
}

async function downloadIllust(illust, recvObj, opt) {
    let result;
    try {
        result = await new Promise((resolve, reject) => {
            request.post(`${secret.serviceRootUrl}/service/PixivPic`, {
                json: {
                    url: illust.url
                },
                timeout: 10000
            }, (err, res, body) => {
                if (err) {
                    reject();
                    return;
                }
                resolve(body);
            });
        });

        if (result.err) {
            return null;
        }

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

        return result.url;
    } catch {
        return null;
    }
}

module.exports = async function (recvObj, client) {
    // 读取群、qq规则
    let rule;
    if (
        recvObj.type == recvType.friend ||
        recvObj.type == recvType.groupNonFriend ||
        recvObj.type == recvType.discussNonFriend ||
        recvObj.type == recvType.nonFriend
    ) {
        rule = (await knex('rule_list').where({
            type: 'qq',
            name: recvObj.qq
        }))[0];
    } else {
        rule = (await knex('rule_list').where({
            type: 'group',
            name: recvObj.group
        }))[0];
        if (rule && rule.rule == 'block') {
            return false;
        }
    }

    // 色图计数
    if (/((色|涩|瑟)图|图库)(计数|总(数|计))/.test(recvObj.content)) {
        client.sendMsg(recvObj, '图库总计: ' + illusts.length + '张');
        return true;
    }

    // 生成web服务的url
    if (/(编辑|加|增)(标签|规则|词条)|(标签|规则|词条)(编辑|.*?加|.*?增)/.test(recvObj.content)) {
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
                '请登录：' + `[QQ:url=${encodeURI(`${secret.publicDomainName}/user-tags/login.html?key=${key}`)}]`
            );
        } else {
            client.sendMsg(recvObj, '欧尼酱~请按下图方法与我私聊获得链接~\r\n' +
                `[QQ:pic=${secret.emoticonsPath}${path.sep}user_tags_help.jpg]\r\n` +
                '规则预览：\r\n' +
                `[QQ:url=${encodeURI(`${secret.publicDomainName}/user-tags/edit.html`)}]`
            );
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
    if (/(重|重新|再)发/.test(recvObj.content)) {
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
            regExp = new RegExp(userTag.match, 'i');
        } else {
            regExp = new RegExp(replaceRegexpChar(userTag.match).split(',').join('|'), 'i')
        }
        if (regExp.test(recvObj.content)) {
            if (rule && rule.rule == 'block') {
                client.sendMsg(recvObj, '您的色图功能已被禁用，如有疑问请联系QQ：23458057');
                return true;
            }
            PixivPic(recvObj, client, userTag.rawTags.toLowerCase().split(','), {
                autoBurst,
                burstNum,
                num,
                rule
            });
            return true;
        }
    }

    // Fallback
    if (/(色|涩|瑟)图|gkd|ghs|搞快点|开车|不够(色|涩|瑟)|av|安慰|学习/i.test(recvObj.content)) {
        if (rule && rule.rule == 'block') {
            client.sendMsg(recvObj, '您的色图功能已被禁用，如有疑问请联系QQ：23458057');
            return true;
        }
        PixivPic(recvObj, client, null, {
            autoBurst,
            burstNum,
            num,
            rule
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

    if (!userList[recvObj.qq]) {
        userList[recvObj.qq] = {
            count: userBlockMaxCount,
            cd: userBlockCD,
            seenList: []
        }
    }

    // ban恶意刷图
    if (!(opt.rule && opt.rule.rule == 'white') &&
        userList[recvObj.qq].count <= 0) {
        if (!(await knex('rule_list').where('type', 'qq').andWhere('name', recvObj.qq))[0]) {
            await knex('rule_list').insert({
                type: 'qq',
                name: recvObj.qq,
                rule: 'block'
            });
        } else {
            await knex('rule_list').where('type', 'qq').andWhere('name', recvObj.qq).update('rule', 'block');
        }
        delete userList[recvObj.qq];
        return;
    }

    if (!groupList[recvObj.group]) {
        groupList[recvObj.group] = {
            count: groupBlockMaxCount,
            cd: groupBlockCD
        }
    }
    // 白名单
    if (!(
            recvObj.type == recvType.friend ||
            recvObj.type == recvType.groupNonFriend ||
            recvObj.type == recvType.discussNonFriend ||
            recvObj.type == recvType.nonFriend
        )) {
        if (!(opt.rule && opt.rule.rule == 'white')) {
            if (groupList[recvObj.group].count <= 0 && !opt.resend) {
                client.sendMsg(recvObj, '搞太快了~ 请等待' +
                    (parseInt(groupList[recvObj.group].cd / 60) == 0 ? '' : (parseInt(groupList[recvObj.group].cd / 60) + '分')) +
                    groupList[recvObj.group].cd % 60 + '秒'
                );
                return;
            }
        }
    }

    let illust;
    let illustPath;
    try {
        illust = await searchIllust(recvObj, tags, opt, userList[recvObj.qq].seenList);
        if (!illust) throw 'illust is null';
        illustPath = await downloadIllust(illust, recvObj, opt);
    } catch {}

    if (illustPath) {
        if (!opt.resend) {
            // 群聊才减充能
            if (!(
                    recvObj.type == recvType.friend ||
                    recvObj.type == recvType.groupNonFriend ||
                    recvObj.type == recvType.discussNonFriend ||
                    recvObj.type == recvType.nonFriend
                )) {
                groupList[recvObj.group].count--;
            } else {
                userList[recvObj.qq].seenList.push({
                    id: illust.id
                });
            }
            userList[recvObj.qq].count--;
        }
        client.sendMsg(recvObj, `[QQ:pic=${illustPath}]`);
    } else {
        client.sendMsg(recvObj, `[QQ:pic=${secret.emoticonsPath}${path.sep}satania_cry.gif]`);
    }
}