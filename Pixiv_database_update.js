const fs = require('fs');
const PixivAppApi = require('pixiv-app-api');
const _ = require('lodash');
require('colors');
const EventEmitter = require('events');

const secret = JSON.parse(fs.readFileSync('./secret.json', 'utf8'));

const pixivClients = [];
for (const account of secret.PixivAPIAccounts) {
    const pixiv = new PixivAppApi(account.userName, account.password, {
        camelcaseKeys: true
    });
    pixiv.rStatus = true;
    pixiv.rEvent = new EventEmitter();
    pixivClients.push(pixiv);
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

const requests = [];
const requestEvent = new EventEmitter();

(async function () {
    for (const pixivClient of pixivClients) {
        await pixivClient.login();
    }
    const pixivLoginTimer = setInterval(async () => {
        for (const pixivClient of pixivClients) {
            await pixivClient.login();
        }
    }, 3600000);

    const illusts = await knex('illusts');
    for (let i = 0; i < illusts.length; i++) {
        const illust = illusts[i];

        getIllust(curPixivClient, illust, {
            index: i,
            length: illusts.length
        });

        await new Promise(resolve => {
            if (requests.length < 10) resolve();
            requestEvent.on('finish', onFinish);

            function onFinish() {
                resolve();
                requestEvent.off('finish', onFinish);
            }
        });
    }

    clearInterval(pixivLoginTimer);
    process.exit();
})();

async function getIllust(pixiv, illust, progress) {
    requests.push(progress.i);

    let detail;
    try {
        if (!pixiv.rStatus) throw 'Pixiv client no recovery';
        detail = (await pixiv.illustDetail(illust.id)).illust;
    } catch (error) {
        if (error.response && error.response.status == 404) {
            console.log('Illust has been deleted'.red.bold);
            await knex('illusts').where('id', illust.id).delete();
            requests.splice(progress.i, 1);
            requestEvent.emit('finish');
            return;
        }
        console.log('Network failed'.red.bold);

        if (pixiv.rStatus) {
            pixiv.rStatus = false;
            setTimeout(() => {
                pixiv.rStatus = true;
                pixiv.rEvent.emit('recovery', pixiv);
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

        await curPixivClient.login();
        requests.splice(progress.i, 1);
        return getIllust(curPixivClient, illust, progress);
    }

    let level = null;
    if (!_.isEmpty(detail)) {
        switch (detail.xRestrict) {
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
                level = 'unknow:' + detail.xRestrict;
                break;
        }
    }

    let tags = '';
    for (const tag of detail.tags) {
        tags += tags ? (',' + tag.name) : tag.name;
    }

    await knex('illusts').where('id', illust.id).update({
        title: detail.title,
        image_url: detail.imageUrls.large.match(/^http.*?\.net|img-master.*$/g).join('/'),
        user_id: detail.user.id,
        level,
        tags,
        create_date: detail.createDate,
        page_count: detail.pageCount,
        width: detail.width,
        height: detail.height,
        total_view: detail.totalView,
        total_bookmarks: detail.totalBookmarks
    });

    console.log(`[${progress.index}/${progress.length}]`.green, illust.id, detail.title, level ? level.bold : level);

    requests.splice(progress.i, 1);
    requestEvent.emit('finish');
}