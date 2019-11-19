const fs = require('fs');
const PixivAppApi = require('pixiv-app-api');
const util = require('util');
const _ = require('lodash');
require('colors');
const moment = require('moment');
const EventEmitter = require('events');

// 获得参数
const tagList = _.isUndefined(process.argv[2]) ? null : process.argv[2].split(',');
if (!tagList) {
    console.log('Tags input is incorrect!'.red.bold);
    return;
}
const argName = _.isUndefined(process.argv[3]) ? 'all' : process.argv[3];
const argYears = _.isUndefined(process.argv[4]) ? 10 : parseInt(process.argv[4]);
const argMonths = _.isUndefined(process.argv[5]) ? 0 : parseInt(process.argv[5]);
const argDays = _.isUndefined(process.argv[6]) ? 0 : parseInt(process.argv[6]);

const secret = JSON.parse(fs.readFileSync('./secret.json', 'utf8'));

const pixivClients = [];
for (const account of secret.PixivAPIAccounts) {
    const pixivClient = new PixivAppApi(account.userName, account.password, {
        camelcaseKeys: true
    });
    pixivClient.rStatus = true;
    pixivClient.rEvent = new EventEmitter();
    pixivClients.push(pixivClient);
}

let curPixivClient = pixivClients[0];

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
    if (!(await knex.schema.hasTable('illusts'))) {
        await knex.schema.createTable('illusts', table => {
            table.integer('id').unsigned().primary();
        });
    }
    if (!(await knex.schema.hasTable('recovery_work'))) {
        await knex.schema.createTable('recovery_work', table => {
            table.string('name').primary();
        });
    }

    if (!(await knex.schema.hasColumn('illusts', 'title'))) {
        await knex.schema.table('illusts', table => {
            table.string('title');
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'image_url'))) {
        await knex.schema.table('illusts', table => {
            table.string('image_url', 2048);
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'user_id'))) {
        await knex.schema.table('illusts', table => {
            table.integer('user_id').unsigned();
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'level'))) {
        await knex.schema.table('illusts', table => {
            table.string('level').index('level');
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'tags'))) {
        await knex.schema.table('illusts', table => {
            table.string('tags');
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'create_date'))) {
        await knex.schema.table('illusts', table => {
            table.dateTime('create_date');
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'page_count'))) {
        await knex.schema.table('illusts', table => {
            table.integer('page_count').unsigned();
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'width'))) {
        await knex.schema.table('illusts', table => {
            table.integer('width').unsigned();
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'height'))) {
        await knex.schema.table('illusts', table => {
            table.integer('height').unsigned();
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'total_view'))) {
        await knex.schema.table('illusts', table => {
            table.integer('total_view').unsigned();
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'total_bookmarks'))) {
        await knex.schema.table('illusts', table => {
            table.integer('total_bookmarks').unsigned();
        });
    }

    if (!(await knex.schema.hasColumn('recovery_work', 'year'))) {
        await knex.schema.table('recovery_work', table => {
            table.integer('year').unsigned();
        });
    }
    if (!(await knex.schema.hasColumn('recovery_work', 'month'))) {
        await knex.schema.table('recovery_work', table => {
            table.integer('month').unsigned();
        });
    }
    if (!(await knex.schema.hasColumn('recovery_work', 'date'))) {
        await knex.schema.table('recovery_work', table => {
            table.integer('date').unsigned();
        });
    }

    console.log('\nDatabase init finished'.green.bold);
}

(async function () {
    await initDatabase();

    // 恢复作业
    let recoveryWork = (await knex('recovery_work').where('name', argName))[0];

    for (const pixivClient of pixivClients) {
        await pixivClient.login();
    }
    // 长期作业
    const pixivLoginTimer = setInterval(async () => {
        for (const pixivClient of pixivClients) {
            await pixivClient.login();
        }
    }, 3600000);

    let count = 0;
    let dayCount = 0;
    const counterTimer = setInterval(() => {
        console.log(util.format('Total count:', count).magenta);
    }, 10000);

    const curDate = moment();
    const targetDate = moment(curDate);
    targetDate.subtract(argYears, 'years');
    targetDate.subtract(argMonths, 'months');
    targetDate.subtract(argDays, 'days');

    console.log(util.format('\nTarget date:', targetDate.format('YYYY-MM-DD'), '\n').cyan.bold);

    let year;
    let month;
    let date;

    if (recoveryWork) {
        year = recoveryWork.year
        month = recoveryWork.month
        date = recoveryWork.date
        recoveryWork = null;
    } else {
        year = curDate.year();
        month = curDate.month() + 1;
        date = curDate.date();
    }

    let outOfRange = false;
    let isDateDesc = true;
    for (; year > 0; year--) {
        if (outOfRange) break;

        for (; month > 0; month--) {
            if (outOfRange) break;

            if (date == 0) {
                const specifiedDate = moment({
                    year: month == 12 ? year + 1 : year,
                    month: month == 12 ? 0 : month,
                    date: 1
                }).subtract(1, 'days');
                date = specifiedDate.date();
            }

            for (; date > 0; date--) {
                if (moment({
                        year,
                        month: month - 1,
                        date
                    }) - targetDate < 0) {
                    outOfRange = true;
                    break;
                }

                dayCount = 0;

                // 记录当前作业
                await recordWork(year, month, date);

                console.log(`${year}-${month}-${date}`.green);

                let illusts;
                try {
                    illusts = (await curPixivClient.searchIllust(tagList.join(' OR ') + ' -腐 -足りない', {
                        sort: isDateDesc ? 'date_desc' : 'date_asc',
                        startDate: `${year}-${month}-${date}`,
                        endDate: `${year}-${month}-${date}`
                    })).illusts;
                } catch {
                    console.log('Network failed'.red.bold);

                    await waitPixivClientRecovery();

                    await curPixivClient.login();
                    date++;
                    continue;
                }

                for (const illust of illusts) {
                    testIllust(illust);
                    count++;
                    dayCount++
                }

                while (curPixivClient.hasNext()) {
                    illusts = null;

                    try {
                        illusts = (await curPixivClient.next()).illusts;
                    } catch {
                        console.log(util.format('Day count:', dayCount).magenta.bold);
                        if (dayCount > 5000) {
                            console.error('Exceed the limit'.red.bold);
                            // 用升序再试一遍，这样单天至少能刷到1w张
                            if (isDateDesc) {
                                isDateDesc = false;
                                date++;
                                break;
                            } else {
                                isDateDesc = true;
                                break;
                            }
                        }
                        console.log('Network failed'.red.bold);

                        await waitPixivClientRecovery();

                        await curPixivClient.login();
                        date++;
                        break;
                    }

                    for (const illust of illusts) {
                        testIllust(illust);
                        count++;
                        dayCount++;
                    }
                }

                async function waitPixivClientRecovery() {
                    if (curPixivClient.rStatus) {
                        curPixivClient.rStatus = false;
                        setTimeout(() => {
                            curPixivClient.rStatus = true;
                            curPixivClient.rEvent.emit('recovery', curPixivClient);
                        }, 300000);
                    }

                    let isFound = false;
                    for (const pixivClient of pixivClients) {
                        if (pixivClient.rStatus) {
                            curPixivClient = pixivClient;
                            isFound = true;
                            break;
                        }
                    }
                    if (!isFound) {
                        await new Promise(resolve => {
                            for (const pixivClient of pixivClients) {
                                pixivClient.rEvent.on('recovery', onRecovery);
                            }

                            function onRecovery(client) {
                                for (const pixivClient of pixivClients) {
                                    pixivClient.rEvent.off('recovery', onRecovery);
                                }
                                curPixivClient = client;
                                resolve();
                            }
                        });
                    }
                }
            }
        }
        month = 12;
    }

    clearInterval(pixivLoginTimer);
    clearInterval(counterTimer);
    // 执行完了需要干掉自己的作业记录
    await knex('recovery_work').where('name', argName).delete();
    process.exit();
})();

function testIllust(illust) {
    // 只要插画
    if (illust.type != 'illust') return;

    let tags = '';
    for (const tag of illust.tags) {
        tags += tags ? (',' + tag.name) : tag.name;
    }
    illust.tags = tags;

    // 不要黑车
    if (/男/.test(illust.tags)) {
        if (!(/男の娘|ちんちんの付いた美少女/.test(illust.tags))) return;
    }

    // 不要小于1000收藏
    if (illust.totalBookmarks < 1000) return;

    setIllust(illust);
}

async function setIllust(illust) {
    let level = '';
    switch (illust.xRestrict) {
        case 0:
            level = 'safe';
            break
        case 1:
            level = 'r18';
            break;
        case 2:
            level = 'r18g';
            break;
        default:
            level = 'unknow:' + illust.xRestrict;
            break;
    }
    const data = {
        title: illust.title,
        image_url: illust.imageUrls.large.match(/^http.*?\.net|img-master.*$/g).join('/'),
        user_id: illust.user.id,
        level,
        tags: illust.tags,
        create_date: illust.createDate,
        page_count: illust.pageCount,
        width: illust.width,
        height: illust.height,
        total_view: illust.totalView,
        total_bookmarks: illust.totalBookmarks
    }
    if ((await knex('illusts').where('id', illust.id))[0]) {
        await knex('illusts').where('id', illust.id).update(data);
        console.log('update=>', illust.id, illust.title, level);
    } else {
        await knex('illusts').insert({
            id: illust.id,
            ...data
        });
        console.log(util.format('set=>', illust.id, illust.title, level).bold);
    }
}

async function recordWork(year, month, date) {
    const data = {
        year,
        month,
        date
    }
    if ((await knex('recovery_work').where('name', argName))[0]) {
        await knex('recovery_work').where('name', argName).update(data);
    } else {
        await knex('recovery_work').insert({
            name: argName,
            ...data
        });
    }
}