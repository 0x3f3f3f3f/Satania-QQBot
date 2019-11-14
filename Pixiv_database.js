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

    await pixiv.login();
    // 长期作业
    const pixivLoginTimer = setInterval(async () => {
        await pixiv.login();
    }, 3600000);

    let count = 0;
    let dayCount = 0;
    const counterTimer = setInterval(() => {
        console.log('\ncount:', count, '\n');
    }, 10000);

    const curDate = new Date();

    for (const tag of tagList) {
        let y = curDate.getFullYear();
        let m = curDate.getMonth() + 1;
        let d = curDate.getDate();

        for (; y >= 2010; y--) {
            for (; m > 0; m--) {
                if (d == 0) {
                    const date = new Date(y, m, 0);
                    d = date.getDate();
                }

                for (; d > 0; d--) {
                    console.log(`\n${y}-${m}-${d}`, tag, 'day count:', dayCount, '\n');
                    dayCount = 0;
                    let illusts;
                    try {
                        illusts = (await pixiv.searchIllust(tag, {
                            startDate: `${y}-${m}-${d}`,
                            endDate: `${y}-${m}-${d}`
                        })).illusts;
                    } catch {
                        if (dayCount > 5000) {
                            console.error('\nExceed the limit\n');
                            continue;
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
                        d++;
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
                            d++;
                            break;
                        }

                        for (const illust of illusts) {
                            testIllust(illust);
                            count++;
                            dayCount++;
                        }
                    }
                }
            }
            m = 12;
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