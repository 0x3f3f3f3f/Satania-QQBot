const _ = require('lodash');

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

    await Promise.all([apiPage.close(), manualPage.close(), translatePage.close()]);

    isInitialized = true;
});

module.exports = function (recvObj, client) {
    let type = null;
    if (/api/ig.test(recvObj.content)) {
        type = DocType.api;
    } else if (/手.*?册/g.test(recvObj.content)) {
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
        client.sendMsg(recvObj, '萨塔尼亚还没准备好~');
        return;
    }
    let searchText = recvObj.content.replace(/\[.*?\]|api|手.*册/g, '').trim();
    if (_.isEmpty(searchText)) {
        client.sendMsg(recvObj, '你居然没写关键词？');
        return;
    }

    client.sendMsg(recvObj, '搜索中~');

    let translate = await browser.newPage();
    try {
        translate.goto(`https://translate.google.com/#view=home&op=translate&sl=auto&tl=en&text=${encodeURIComponent(searchText)}`);
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
        page.goto(`${DocUrl[type]}30_search.html?q=${encodeURIComponent(searchText)}`, {
            timeout: 120000
        });

        await Promise.race([page.waitForSelector('.search-results .result', {
                timeout: 120000
            }),
            page.waitForFunction(() => {
                return document.querySelector(".search-results") && /did not result/ig.test(document.querySelector(".search-results").textContent);
            }, {
                timeout: 120000
            })
        ]);
    } catch {
        client.sendMsg(recvObj, '欧尼酱搜索出错了~喵');
        await translate.close();
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

    let infoText = '';
    if (results) {
        for (const result of results) {
            infoText += (infoText == '' ? '' : '\n') + result.info;
        }
    }

    translate = await browser.newPage();
    try {
        translate.goto(`https://translate.google.com/#view=home&op=translate&sl=auto&tl=zh-CN&text=${encodeURIComponent(infoText)}`);
        await translate.waitForFunction(() => {
            return document.querySelectorAll('.tlid-translation.translation span').length > 0;
        });
        infoText = await translate.evaluate(() => {
            window.stop();
            let infoText = '';
            for (const span of document.querySelectorAll('.tlid-translation.translation span')) {
                infoText += (infoText == '' ? '' : '\n') + span.textContent;
            }
            return infoText;
        });
    } catch {}
    await translate.close();

    if (results) {
        infoText = infoText.split('\n');
        let resultText = '';
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            resultText += (resultText == '' ? '' : '\r\n') + '\r\n' +
                `${DocUrl[type]+result.url}\r\n${result.title}: ${infoText[i]}`
        }

        client.sendMsg(recvObj, `[QQ:at=${recvObj.qq}]\r\n` + resultText);
    } else {
        client.sendMsg(recvObj, '欧尼酱对不起，没有找到你要的~');
    }
}