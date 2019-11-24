const pixivImg = require("pixiv-img");
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
sharp.cache(false);
const _ = require('lodash');
const childProcess = require('child_process');
const moment = require('moment');
const nzhcn = require('nzh/cn');

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

const tagList = [
    '着',
    '乳',
    'おっぱい', //欧派
    '魅惑', //可以匹配到魅惑的大腿、魅惑的乳沟
    '黒スト', //黑Stocking 黑丝袜简称
    '白スト', //白Stocking 白丝袜简称
    'ニーソ', //Knee socks 过膝袜简称
    'タイツ', //Tights 裤袜
    'パンスト', //Panty stocking 裤袜简称
    'ストッキング', //Stocking 丝袜
    'ルーズソックス', //Loose socks 泡泡袜
    '丝袜',
    '足',
    '尻',
    'ぱんつ', //Pants 胖次
    'パンツ', //Pants 胖次
    'パンティ', //Panty 内裤
    'パンチラ', //露内裤
    '縛',
    '束',
    'ロリ', //萝莉
    '幼女',
    '獣耳',
    '男の娘',
    'ちんちんの付いた美少女' //带把美少女
]

const charTagList = [
    'レム(リゼロ)', //蕾姆
    '初音ミク', //初音未来
    'サターニャ', //萨塔妮娅
    '胡桃沢=サタニキア=マクドウェル', //胡桃泽·萨塔妮基亚·麦克道威尔
    '時崎狂三'
]

function replaceRegexpChar(tag) {
    return tag.replace(/(?=[\(\)\=])/g, '\\');
}

function updateIllusts() {
    childProcess.fork('Pixiv_database.js', [tagList.join(',') + ',' + charTagList.join(), 'day', 0, 0, 7]);
}

async function searchIllust(recvObj, tags, opt) {
    let illustsQuery;
    let illust;

    if (tags) {
        let stringQuery = '';
        for (const tag of tags) {
            stringQuery += stringQuery ? ` or \`tags\` like \'%${tag}%\'` : `(\`tags\` like \'%${tag}%\'`;
        }
        if (recvObj.type != 1) {
            stringQuery = '\`rating\` not like \'r18%\' and ' + stringQuery;
        }
        stringQuery += ')';
        illustsQuery = knex('illusts').whereRaw(stringQuery);
    } else {
        if (recvObj.type == 1) {
            illustsQuery = knex('illusts');
        } else {
            illustsQuery = knex('illusts').where('rating', 'not like', 'r18%')
        }
    }
    if (!opt.resend) {
        if ((recvObj.type == 1 || recvObj.type == 3 || recvObj.type == 5 || recvObj.type == 6) && opt.num > 1000) {
            illustsQuery.where('total_bookmarks', '>=', opt.num);
        } else {
            const rand = 1 - Math.pow(1 - Math.random(), 2) * 20000;
            if (rand > 1000)
                illustsQuery.where('total_bookmarks', '>=', rand);
        }
    }

    if (!(recvObj.type == 1 || recvObj.type == 3 || recvObj.type == 5 || recvObj.type == 6) && recvObj != '') {
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
    if (!tags && !(new RegExp(tagList.join('|')).test(illust.tags))) {
        return searchIllust(recvObj, tags, opt);
    }

    return illust;
}

async function downloadIllust(illust, recvObj, opt) {
    try {
        const illustPath = path.join(secret.tempPath, 'image', 'illust_' + path.basename(illust.image_url));
        await pixivImg(illust.image_url, illustPath);
        if (!opt.resend && !(recvObj.type == 1 || recvObj.type == 3 || recvObj.type == 5 || recvObj.type == 6) && recvObj.group != '') {
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

//支持的标签
let tagDic = 
[
    { RegExp :/奶|乳|胸|欧派|咪咪/m ,JapaneseTags = ['乳,おっぱい', '魅惑の谷間']},
    { RegExp :/黑丝/m ,JapaneseTags = ['黒スト', '黒ニーソ', '黒タイツ']},
    { RegExp :/白丝/m ,JapaneseTags = ['白スト', '白ニーソ', '白タイツ']},
    { RegExp :/泡泡袜/m ,JapaneseTags = ['ルーズソックス']},
    { RegExp :/吊带袜|吊袜带/m ,JapaneseTags = ['ガーターストッキング', 'ガーターベルト']},
    { RegExp :/袜/m ,JapaneseTags = ['丝袜', 'タイツ,パンスト', 'ストッキング']},
    { RegExp :/腿/m ,JapaneseTags = ['魅惑のふともも']},
    { RegExp :/屁股|臀|屁屁/m ,JapaneseTags = ['尻']},
    { RegExp :/(足|脚)底/m ,JapaneseTags = ['足裏']},
    { RegExp :/足|脚|jio/im ,JapaneseTags = ['足']},
    { RegExp :/胖次|内裤|小裤裤/m ,JapaneseTags = ['ぱんつ', 'パンツ', 'パンティ', 'パンチラ']},
    { RegExp :/拘|束|捆|绑|缚/m ,JapaneseTags = ['拘束', '緊縛']},
    { RegExp :/萝莉|幼女|炼铜/m ,JapaneseTags = ['ロリ', '幼女']},
    { RegExp :/兽耳|兽娘/m ,JapaneseTags = ['獣耳']},
    { RegExp :/伪娘|女装|铝装|可爱的男|带把/m ,JapaneseTags = ['男の娘', 'ちんちんの付いた美少女']},
    { RegExp :/(蕾|雷)(姆|母)|rem/im ,JapaneseTags = ['レム(リゼロ)']},
    { RegExp :/初音|初音未来|miku|hatsunemiku|hatsune miku|公主殿下/im ,JapaneseTags = ['初音ミク']},
    { RegExp :/(萨|傻|撒)塔(妮|尼)(娅|亚)/m ,JapaneseTags = ['サターニャ', '胡桃沢=サタニキア=マクドウェル']},
    { RegExp :/狂三|时崎狂三|三三/m ,JapaneseTags = ['時崎狂三']},
    //{ RegExp :/狂三|时崎狂三|三三/m ,JapaneseTags = ['時崎狂三']},
    //{ RegExp :/狂三|时崎狂三|三三/m ,JapaneseTags = ['時崎狂三']},
    //{ RegExp :/狂三|时崎狂三|三三/m ,JapaneseTags = ['時崎狂三']},
    //{ RegExp :/狂三|时崎狂三|三三/m ,JapaneseTags = ['時崎狂三']},
    //{ RegExp :/狂三|时崎狂三|三三/m ,JapaneseTags = ['時崎狂三']},
    //在此处上方添加新的Tag！
    { RegExp :/(色|涩|瑟)图|gkd|搞快点|开车|不够(色|涩|瑟)/im ,JapaneseTags = null},
];

module.exports = async function (recvObj, client) {
    // 群黑名单
    if ((recvObj.type == 1 || recvObj.type == 3 || recvObj.type == 5 || recvObj.type == 6)) {
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
    if ((recvObj.type == 1 || recvObj.type == 3 || recvObj.type == 5 || recvObj.type == 6) &&
        /(十|10)连/m.test(recvObj.content)) {
        autoBurst = true;
        burstNum = 10;
    } else if (/(三|3)连/m.test(recvObj.content)) {
        autoBurst = true;
        burstNum = 3;
    }

    //按照数组顺序贪婪匹配
    tagDic.forEach(element => {
        if (element.RegExp.test(recvObj.content)) {
            PixivPic(recvObj, client, element.JapaneseTags, {
                autoBurst,
                burstNum,
                num
            });
            return true;
        }
    });

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
    if (!(recvObj.type == 1 || recvObj.type == 3 || recvObj.type == 5 || recvObj.type == 6)) {
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
        illustCharge[recvObj.group].count--;
        client.sendMsg(recvObj, `[QQ:pic=${illustPath}]`);
    } else {
        client.sendMsg(recvObj, `[QQ:pic=${secret.emoticonsPath}\\satania_cry.gif]`);
    }
}