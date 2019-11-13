const fs = require('fs');
const PixivAppApi = require('pixiv-app-api');
const puppeteer = require('puppeteer');

const secret = JSON.parse(fs.readFileSync('./secret.json', 'utf8'));

const pixiv = new PixivAppApi(secret.PixivUserName, secret.PixivPassword, {
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
    await page.waitForSelector('.tag-list');

    const tagList = await page.evaluate(() => {
        window.close();
        const tagList = document.querySelectorAll('.tag-list li');
        const result = [];
        for (const tag of tagList) {
            result.push(tag.querySelector('.tag-value').textContent)
        }
        return result;
    });
    await browser.close();

    await pixiv.login();
    // 长期作业
    const pixivLoginTimer = setInterval(async () => {
        await pixiv.login();
    }, 3600000);

    let count = 0;
    const counterTimer = setInterval(() => {
        console.log('count:', count);
    }, 10000);
    // 前方高能反映！循环所有标签！
    for (const tag of tagList) {
        console.log('Start tag:', tag);

        let illusts;
        while (!illusts) {
            try {
                illusts = (await pixiv.searchIllust(tag, {
                    searchTarget: 'exact_match_for_tags'
                })).illusts;
            } catch {
                console.warn('Network failed.');
            }
        }

        for (const illust of illusts) {
            testIllust(illust);
            count++;
        }

        while (pixiv.hasNext()) {
            illusts = null;
            while (!illusts) {
                try {
                    illusts = (await pixiv.next()).illusts;
                } catch {
                    console.warn('Network failed.');
                }
            }
            for (const illust of illusts) {
                testIllust(illust);
                count++;
            }
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