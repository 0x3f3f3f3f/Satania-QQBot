const fs = require('fs');
const PixivAppApi = require('pixiv-app-api');
const puppeteer = require('puppeteer');

const secret = JSON.parse(fs.readFileSync('./secret.json', 'utf8'));

let pixivUserName = secret.PixivUserName;

let pixiv = new PixivAppApi(pixivUserName, secret.PixivPassword, {
    camelcaseKeys: true
});

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
    if (!(await knex.schema.hasColumn('recovery_work', 'tag'))) {
        await knex.schema.table('recovery_work', table => {
            table.string('tag');
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

    console.log('\n\nDatabase init finished');
}

(async function () {
    await initDatabase();

    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: secret.chromiumUserData,
        args: [
            '--proxy-server="direct://"',
            '--proxy-bypass-list=*'
        ]
    });

    const page = await browser.newPage();

    page.goto('https://www.pixiv.net/tags.php', {
        timeout: 0
    });
    await page.waitForSelector('.tag-list', {
        timeout: 0
    });

    const tagList = await page.evaluate(() => {
        window.stop();
        const tagList = document.querySelectorAll('.tag-list li');
        const result = [];
        for (const tag of tagList) {
            result.push(tag.querySelector('.tag-value').textContent.trim());
        }
        return result;
    });
    await browser.close();

    tagList.unshift('丝袜');
    tagList.unshift('ストッキング');
    tagList.unshift('タイツ');
    tagList.unshift('白スト');
    tagList.unshift('黒スト');
    tagList.unshift('束');
    tagList.unshift('縛');
    tagList.unshift('足');

    tagList.splice(tagList.indexOf('R-18'), 1);
    tagList.splice(tagList.indexOf('裸足'), 1);
    tagList.splice(tagList.indexOf('黒タイツ'), 1);

    // 恢复作业
    let recoveryWork = (await knex('recovery_work').where('name', 'all'))[0];

    await pixiv.login();
    // 长期作业
    const pixivLoginTimer = setInterval(async () => {
        await pixiv.login();
    }, 3600000);

    let count = 0;
    let dayCount = 0;
    const counterTimer = setInterval(() => {
        console.log('Total count:', count);
    }, 10000);

    const curDate = new Date();

    for (const tag of tagList) {
        let year;
        let month;
        let date;

        if (recoveryWork) {
            if (tag != recoveryWork.tag) continue;
            year = recoveryWork.year
            month = recoveryWork.month
            date = recoveryWork.date
            recoveryWork = null;
        } else {
            year = curDate.getFullYear();
            month = curDate.getMonth() + 1;
            date = curDate.getDate();
        }

        for (; year >= 2010; year--) {
            for (; month > 0; month--) {
                if (date == 0) {
                    const date = new Date(year, month, 0);
                    date = date.getDate();
                }

                for (; date > 0; date--) {
                    dayCount = 0;

                    // 记录当前作业
                    await recordWork(tag, year, month, date);

                    console.log(`${year}-${month}-${date}`, tag);

                    let illusts;
                    try {
                        illusts = (await pixiv.searchIllust(tag, {
                            startDate: `${year}-${month}-${date}`,
                            endDate: `${year}-${month}-${date}`
                        })).illusts;
                    } catch {
                        console.error('\nNetwork failed\n');
                        if (pixivUserName == secret.PixivUserName) {
                            pixivUserName = secret.PixivUserName2;
                            pixiv = new PixivAppApi(secret.PixivUserName2, secret.PixivPassword2, {
                                camelcaseKeys: true
                            });
                        } else {
                            pixivUserName = secret.PixivUserName;
                            pixiv = new PixivAppApi(secret.PixivUserName, secret.PixivPassword, {
                                camelcaseKeys: true
                            });
                        }
                        await pixiv.login();
                        date++;
                        continue;
                    }

                    for (const illust of illusts) {
                        testIllust(illust);
                        count++;
                        dayCount++
                    }

                    while (pixiv.hasNext()) {
                        illusts = null;

                        try {
                            illusts = (await pixiv.next()).illusts;
                        } catch {
                            if (dayCount > 5000) {
                                console.error('\nExceed the limit\n');
                                break;
                            }
                            console.error('\nNetwork failed\n');
                            if (pixivUserName == secret.PixivUserName) {
                                pixivUserName = secret.PixivUserName2;
                                pixiv = new PixivAppApi(secret.PixivUserName2, secret.PixivPassword2, {
                                    camelcaseKeys: true
                                });
                            } else {
                                pixivUserName = secret.PixivUserName;
                                pixiv = new PixivAppApi(secret.PixivUserName, secret.PixivPassword, {
                                    camelcaseKeys: true
                                });
                            }
                            await pixiv.login();
                            date++;
                            break;
                        }

                        for (const illust of illusts) {
                            testIllust(illust);
                            count++;
                            dayCount++;
                        }
                    }

                    console.log('Day count:', dayCount);
                }
            }
            month = 12;
        }
    }

    clearInterval(pixivLoginTimer);
    clearInterval(counterTimer);
})();

function testIllust(illust) {
    if (illust.type != 'illust') return;
    // 不要R-18
    let tags = '';
    for (const tag of illust.tags) {
        tags += tags ? (',' + tag.name) : tag.name;
    }
    illust.tags = tags;
    if (/r-18/i.test(illust.tags)) return;
    // 不要小于1000收藏
    if (illust.totalBookmarks < 1000) return;

    setIllust(illust);
}

async function setIllust(illust) {
    const data = {
        title: illust.title,
        image_url: illust.imageUrls.large.match(/^http.*?\.net|img-master.*$/g).join('/'),
        user_id: illust.user.id,
        tags: illust.tags,
        create_date: illust.createDate,
        width: illust.width,
        height: illust.height,
        total_view: illust.totalView,
        total_bookmarks: illust.totalBookmarks
    }
    if ((await knex('illusts').where('id', illust.id))[0]) {
        await knex('illusts').where('id', illust.id).update(data);
    } else {
        await knex('illusts').insert({
            id: illust.id,
            ...data
        });
    }
    console.log('set=>', illust.id, illust.title);
}

async function recordWork(tag, year, month, date) {
    const data = {
        tag,
        year,
        month,
        date
    }
    if ((await knex('recovery_work').where('name', 'all'))[0]) {
        await knex('recovery_work').update(data);
    } else {
        await knex('recovery_work').insert({
            name: 'all',
            ...data
        });
    }
}