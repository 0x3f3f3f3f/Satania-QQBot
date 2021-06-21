const fs = require('fs');
const _ = require('lodash');
require('colors');
const {
    EventEmitter
} = require('events');
const moment = require('moment');

global.secret = JSON.parse(fs.readFileSync('../secret.json', 'utf8'));

const {
    PixivAppApi,
    errorCode
} = require('../libs/PixivAppApi');

const pixivClients = [];
for (const account of secret.PixivAPIAccounts) {
    const pixivClient = new PixivAppApi(account.userName, account.token);
    pixivClients.push(pixivClient);
}

let curPixivClient = pixivClients[0];

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

const requests = [];
const requestEvent = new EventEmitter();

const index = _.isUndefined(process.argv[2]) ? 0 : parseInt(process.argv[2]) - 1;

(async function () {
    for (let i = pixivClients.length - 1; i >= 0; i--) {
        const pixivClient = pixivClients[i];

        try {
            await pixivClient.login();
        } catch (e) {
            switch (e) {
                case errorCode.NetError:
                    i++;
                    break;
                case errorCode.LoginFail:
                    pixivClients.splice(i, 1);
                    break;
            }
        }
    }

    if (pixivClients.length == 0) {
        console.log('No account login...'.red.bold);
        process.exit();
    }

    const illusts = await knex('illusts');
    for (let i = index; i < illusts.length; i++) {
        const illust = illusts[i];

        getIllust(curPixivClient, illust, {
            index: i,
            length: illusts.length
        });

        await new Promise(resolve => {
            if (requests.length < 5) {
                resolve();
                return;
            }
            requestEvent.on('finish', onFinish);

            function onFinish() {
                requestEvent.off('finish', onFinish);
                resolve();
            }
        });
    }

    await new Promise(resolve => {
        if (requests.length == 0) {
            resolve();
            return;
        }
        requestEvent.on('finish', onFinish);

        function onFinish() {
            if (requests.length == 0) {
                requestEvent.off('finish', onFinish);
                resolve();
            }
        }
    });

    process.exit();
})();

async function getIllust(pixiv, illust, progress) {
    requests.push(progress.i);

    let detail;
    try {
        if (!pixiv.isReady) throw 'Pixiv client no recovered';
        detail = (await pixiv.illustDetail(illust.id)).illust;
    } catch (e) {
        if (e == errorCode.NoExist) {
            console.log(`[${progress.index+1}/${progress.length}]`.green, illust.id, 'Illust has been deleted'.red.bold);
            await knex('illusts').where('id', illust.id).delete();
            for (let i = requests.length - 1; i >= 0; i--) {
                if (requests[i] == progress.i) {
                    requests.splice(i, 1);
                    break;
                }
            }
            requestEvent.emit('finish');
            return;
        } else {
            pixiv.startRecover();

            let accountStatus = '';
            for (const pixivClient of pixivClients) {
                if (pixivClient.isReady) accountStatus += '[' + 'a'.green + ']';
                else accountStatus += '[' + 'd'.red.bold + ']';
            }

            switch (e) {
                case errorCode.NetError:
                    console.log('Network failed'.red.bold, accountStatus);
                    break;
                case errorCode.OffestLimit:
                    console.log('Offest limit'.red.bold, accountStatus);
                    break;
                case errorCode.NoExist:
                    console.log('No exist'.red.bold, accountStatus);
                    break;
                case errorCode.NoNextPage:
                    console.log('No next page'.red.bold, accountStatus);
                    break;
                case errorCode.RateLimit:
                    console.log('Rate limit'.red.bold, accountStatus);
                    break;
                case errorCode.UnknowError:
                    console.log('Unknow error'.red.bold, accountStatus);
                    break;
            }

            let isFound = false;
            for (const pixivClient of pixivClients) {
                if (pixivClient.isReady) {
                    curPixivClient = pixivClient;
                    isFound = true;
                    break;
                }
            }
            if (!isFound) {
                const watchdog = [];
                for (const pixivClient of pixivClients) {
                    watchdog.push(pixivClient.recover());
                }

                const _curPC = await Promise.race(watchdog);
                curPixivClient = _curPC;
            }

            await curPixivClient.login();
            for (let i = requests.length - 1; i >= 0; i--) {
                if (requests[i] == progress.i) {
                    requests.splice(i, 1);
                    break;
                }
            }
            return getIllust(curPixivClient, illust, progress);
        }
    }

    let rating = '';
    if (!_.isEmpty(detail)) {
        switch (detail.x_restrict) {
            case 0:
                rating = 'safe';
                break
            case 1:
                rating = 'r18';
                break;
            case 2:
                rating = 'r18g';
                break;
            default:
                rating = 'unknow:' + detail.x_restrict;
                break;
        }
    }

    let tags = '';
    for (const tag of detail.tags) {
        tags += tags ? (',' + tag.name) : tag.name;
    }

    await knex('illusts').where('id', illust.id).update({
        title: detail.title,
        image_url: detail.image_urls.large.match(/^http.*?\.net|img-master.*$/g).join('/'),
        user_id: detail.user.id,
        rating,
        tags,
        create_date: moment(detail.create_date).format("YYYY-MM-DD HH:mm:ss"),
        page_count: detail.page_count,
        width: detail.width,
        height: detail.height,
        total_view: detail.total_view,
        total_bookmarks: detail.total_bookmarks
    });

    console.log(`[${progress.index+1}/${progress.length}]`.green, illust.id, detail.title, rating.bold);

    for (let i = requests.length - 1; i >= 0; i--) {
        if (requests[i] == progress.i) {
            requests.splice(i, 1);
            break;
        }
    }
    requestEvent.emit('finish');
}