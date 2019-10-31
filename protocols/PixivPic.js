const fs = require('fs');
const path = require('path');
const uuid = require('uuid/v4');

if (!fs.existsSync(path.join(secret.tempPath, 'setu')))
    fs.mkdirSync(path.join(secret.tempPath, 'setu'));

const groupList = JSON.parse(fs.readFileSync('./protocols/PixivPic_group_list.json', 'utf8'));

let isInitialized = false;

appEvent.on('unity_doc_initialized', async () => {
    setuClear();

    await setuPull();

    for (let i = 0; i < 5; i++) {
        await setuPush();
    }

    isInitialized = true;
});

// 计时器 每秒执行一次
// 当前小时
let curHours = new Date().getHours();
// 色图技能充能
const setuMaxCharge = 3;
const setuCD = 200;
const setuCharge = {};
const timer = setInterval(() => {
    const curDate = new Date();
    // 每小时清理色图缓存
    if (curHours != curDate.getHours()) {
        curHours = curDate.getHours();
        setuClear();
        // 每天6点更新色图库
        if (curHours == 6) {
            setuPull();
        }
    }
    // 充能（区分每个群）
    for (const groupId in setuCharge) {
        const charge = setuCharge[groupId];
        if (charge.count < setuMaxCharge) {
            charge.cd--;
            if (charge.cd == 0) {
                charge.cd = setuCD;
                charge.count++;
            }
        }
    }
}, 1000);

let setuPool = [];

async function setuPull() {
    const page = await browser.newPage();

    const cookies = secret.PixivCookies.split(';');
    for (let i = 0; i < cookies.length; i++) {
        const name = cookies[i].split('=')[0].trim();
        const value = cookies[i].split('=')[1].trim();
        cookies[i] = {
            name,
            value,
            domain: '.pixiv.net'
        }
    }
    await page.setCookie(...cookies);

    await page.setRequestInterception(true);
    page.on('request', interceptedRequest => {
        if (/\.jpg|\.png|\.gif/i.test(interceptedRequest.url()))
            interceptedRequest.abort();
        else
            interceptedRequest.continue();
    });

    try {
        page.goto('https://www.pixiv.net/ranking.php?mode=male', {
            timeout: 300000
        });

        await page.waitForFunction(() => {
            const items = document.querySelectorAll('.ranking-item');
            if (items.length > 0) {
                if (items.length < 200) {
                    window.scrollBy(0, document.documentElement.scrollHeight);
                    return false;
                } else {
                    return true
                }
            }
            return false;
        }, {
            timeout: 300000
        });
    } catch {
        await page.close();
        return;
    }

    const results = await page.evaluate(() => {
        window.stop();
        const items = document.querySelectorAll('.ranking-item');
        const retArr = [];
        if (items.length > 0) {
            for (const item of items) {
                const imageItem = item.querySelector('.ranking-image-item a');
                // 排除漫画和动图
                if (!/manga|ugoku-illust/i.test(imageItem.getAttribute('class'))) {
                    const tags = imageItem.querySelector('img').getAttribute('data-tags');
                    // 这才是真正的色图
                    if (/着|乳|魅惑|タイツ|スト|足|尻|縛|束/i.test(tags)) {
                        retArr.push(imageItem.getAttribute('href'));
                    }
                }
            }
            return retArr;
        }
        return null;
    });
    await page.close();

    if (results) {
        setuPool = results;
        console.log('已拉取色图库', setuPool.length);
    } else {
        console.error('色图库拉取失败');
    }
}

const setuLink = [];

async function setuPush() {
    if (setuPool.length == 0) return;

    const page = await browser.newPage();

    // 截取所有回应对象
    const responses = [];
    page.on('response', res => {
        responses.push(res);
    });

    const setuIndex = parseInt(Math.random() * setuPool.length);

    try {
        page.goto(`https://pixiv.net${setuPool[setuIndex]}`, {
            timeout: 120000
        });

        await Promise.race([page.waitForFunction(() => {
            const description = document.querySelector('meta[name="description"]');
            if (!description) return false;
            if (/r-18|漫画/i.test(description.getAttribute('content')))
                return true;
            return false;
        }), page.waitForFunction(() => {
            const img = document.querySelector('[role="presentation"] img');
            if (img) return img.complete;
            return false
        }, {
            timeout: 120000
        })]);

        await page.waitForFunction(() => {
            // 目前版面是第三个nav
            const nav = document.querySelectorAll('nav')[2];
            if (nav && nav.lastElementChild)
                return true;
            else
                return false;
        });
    } catch {
        await page.close();
        // 死亡递归！ 
        return setuPush();
    }

    const result = await page.evaluate(() => {
        window.stop();
        // 查找下一张色图
        // 目前版面是第三个nav
        let nextUrl = document.querySelectorAll('nav')[2].lastElementChild.querySelector('a');
        if (nextUrl) {
            nextUrl = nextUrl.getAttribute('href');
        }

        const description = document.querySelector('meta[name="description"]');
        if (description && /r-18|漫画/i.test(description.getAttribute('content'))) {
            return {
                url: 'r18manga',
                nextUrl
            }
        } else {
            const img = document.querySelector('[role="presentation"] img');
            return {
                url: img.getAttribute('src'),
                nextUrl
            }
        }
    });

    // 如果是r18或者漫画继续递归
    if (result.url == 'r18manga') {
        await page.close();
        if (result.nextUrl) {
            setuPool[setuIndex] = result.nextUrl;
        } else {
            setuPool.splice(setuIndex, 1);
        }
        return setuPush();
    }

    console.log('缓存色图:', result);

    for (const res of responses) {
        if (res.url() == result.url) {
            const setuPath = path.join(secret.tempPath, 'setu', path.basename(res.url()));
            fs.writeFileSync(setuPath, await res.buffer());
            setuLink.push(setuPath);
            if (result.nextUrl) {
                setuPool[setuIndex] = result.nextUrl;
            } else {
                setuPool.splice(setuIndex, 1);
            }
            break;
        }
    }
    await page.close();
}

function setuClear() {
    const setuDir = fs.readdirSync(path.join(secret.tempPath, 'setu'));
    for (let i = setuDir.length - 1; i >= 0; i--) {
        const setuPath = setuDir[i];
        for (const link of setuLink) {
            if (path.basename(link) == setuPath) {
                setuDir.splice(i, 1);
                break;
            }
        }
    }
    for (const setuPath of setuDir) {
        fs.unlinkSync(path.join(secret.tempPath, 'setu', setuPath));
    }
}

module.exports = function (recvObj, client) {
    // 群黑名单
    for (const groupId of groupList.block) {
        if (groupId == recvObj.params.group) {
            return false;
        }
    }

    if (/(色|涩|瑟).*?图|gkd|搞快点|开车/im.test(recvObj.params.content)) {
        PixivPic(recvObj, client);
        return true;
    }
    return false;
}

async function PixivPic(recvObj, client) {
    if (!isInitialized) {
        client.sendObj({
            id: uuid(),
            method: "sendMessage",
            params: {
                type: recvObj.params.type,
                group: recvObj.params.group || '',
                qq: recvObj.params.qq || '',
                content: '萨塔尼亚还没准备好~'
            }
        });
        return;
    }

    if (!setuCharge[recvObj.params.group]) {
        setuCharge[recvObj.params.group] = {
            count: setuMaxCharge,
            cd: setuCD
        }
    }
    // 白名单
    for (const groupId of groupList.white) {
        if (groupId == recvObj.params.group) {
            setuCharge[recvObj.params.group].count = 99;
        }
    }

    if (setuCharge[recvObj.params.group].count == 0) {
        client.sendObj({
            id: uuid(),
            method: "sendMessage",
            params: {
                type: recvObj.params.type,
                group: recvObj.params.group || '',
                qq: recvObj.params.qq || '',
                content: '搞太快了~ 请等待' +
                    (parseInt(setuCharge[recvObj.params.group].cd / 60) == 0 ? '' : (parseInt(setuCharge[recvObj.params.group].cd / 60) + '分')) +
                    setuCharge[recvObj.params.group].cd % 60 + '秒'
            }
        });
        return;
    }

    if (setuLink.length == 0) {
        client.sendObj({
            id: uuid(),
            method: "sendMessage",
            params: {
                type: recvObj.params.type,
                group: recvObj.params.group || '',
                qq: recvObj.params.qq || '',
                content: `[QQ:pic=https://sub1.gameoldboy.com/satania_cry.gif]`
            }
        });
    } else {
        setuCharge[recvObj.params.group].count--;
        client.sendObj({
            id: uuid(),
            method: "sendMessage",
            params: {
                type: recvObj.params.type,
                group: recvObj.params.group || '',
                qq: recvObj.params.qq || '',
                content: `[QQ:pic=${setuLink.shift()}]`
            }
        });
        setuPush();
    }
}