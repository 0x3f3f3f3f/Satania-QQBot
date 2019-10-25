const _ = require('lodash');
const uuid = require('uuid/v4');

const DocType = {
    api: 0,
    manual: 1
};
const DocUrl = {
    [0]: 'https://docs.unity3d.com/ScriptReference/',
    [1]: 'https://docs.unity3d.com/Manual/'
}

let isInitialized = false;

appEvent.on('browser_initialized', async () => {
    const apiPage = await browser.newPage();
    const manualPage = await browser.newPage();
    const translatePage = await browser.newPage();

    try {
        await Promise.all([apiPage.goto(`${DocUrl[DocType.api]}30_search.html?q=test`),
            manualPage.goto(`${DocUrl[DocType.manual]}30_search.html?q=test`),
            translatePage.goto('https://translate.google.com/')
        ]);
    } catch {}

    await Promise.all([apiPage.close(), manualPage.close()]);

    isInitialized = true;
});

module.exports = function (recvObj, client) {
    let type = null;
    if (/api/ig.test(recvObj.params.content)) {
        type = DocType.api;
    } else if (/手.*册/g.test(recvObj.params.content)) {
        type = DocType.manual;
    }
    if (type != null) {
        UnityDoc(type, recvObj, client);
        return true
    }
    return false;
}

async function UnityDoc(type, recvObj, client) {
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
    let searchText = recvObj.params.content.replace(/\[.*?\]|api|手.*册/g, '').trim();
    if (_.isEmpty(searchText)) {
        client.sendObj({
            id: uuid(),
            method: "sendMessage",
            params: {
                type: recvObj.params.type,
                group: recvObj.params.group || '',
                qq: recvObj.params.qq || '',
                content: '你居然没写关键词？'
            }
        });
        return;
    }

    client.sendObj({
        id: uuid(),
        method: "sendMessage",
        params: {
            type: recvObj.params.type,
            group: recvObj.params.group || '',
            qq: recvObj.params.qq || '',
            content: '搜索中~'
        }
    });

    const translate = await browser.newPage();
    try {
        translate.goto(encodeURI(`https://translate.google.com/#view=home&op=translate&sl=auto&tl=en&text=${searchText}`));
        await translate.waitForSelector('.tlid-translation.translation');
        searchText = await translate.evaluate(() => {
            window.stop();
            return document.querySelector('.tlid-translation.translation').textContent;
        });
    } catch {}
    await translate.close();
    console.log('Unity Documentation search:', searchText);

    const page = await browser.newPage();

    try {
        page.goto(encodeURI(`${DocUrl[type]}30_search.html?q=${searchText}`));

        await Promise.race([page.waitForSelector('.search-results .result'),
            page.waitForFunction(() => {
                return document.querySelector(".search-results") && /did not result/ig.test(document.querySelector(".search-results").textContent);
            })
        ]);
    } catch {
        client.sendObj({
            id: uuid(),
            method: "sendMessage",
            params: {
                type: recvObj.params.type,
                group: recvObj.params.group || '',
                qq: recvObj.params.qq || '',
                content: '欧尼酱搜索出错了~喵'
            }
        });
        await page.close();
        return;
    }

    const results = await page.evaluate(() => {
        window.stop();
        if (/did not result/ig.test(document.querySelector(".search-results").textContent)) {
            return null;
        }

        const resultElements = document.querySelectorAll('.search-results .result');

        const retArr = [];
        const count = Math.min(resultElements.length, 5);
        for (let i = 0; i < count; i++) {
            const result = resultElements[i];
            retArr.push({
                title: result.querySelector('.title').textContent,
                url: result.querySelector('.title').getAttribute('href'),
                info: result.querySelector('p').textContent
            });
        }

        return retArr;
    });
    await page.close();

    if (results) {
        let resultText = '';
        for (const result of results) {
            resultText += (resultText == '' ? '' : '\r\n') + '\r\n' +
                `${DocUrl[type]+result.url}\r\n${result.title}: ${result.info}`
        }

        client.sendObj({
            id: uuid(),
            method: "sendMessage",
            params: {
                type: recvObj.params.type,
                group: recvObj.params.group || '',
                qq: recvObj.params.qq || '',
                content: `[QQ:at=${recvObj.params.qq}]\r\n` + resultText
            }
        });
    } else {
        client.sendObj({
            id: uuid(),
            method: "sendMessage",
            params: {
                type: recvObj.params.type,
                group: recvObj.params.group || '',
                qq: recvObj.params.qq || '',
                content: '欧尼酱对不起，没有找到你要的~'
            }
        });
    }
}