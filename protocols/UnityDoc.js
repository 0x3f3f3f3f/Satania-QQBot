const puppeteer = require('puppeteer');
const _ = require('lodash');
const uuid = require('uuid/v1');

const DocType = {
    api: 0,
    manual: 1
};
const DocUrl = {
    [0]: 'https://docs.unity3d.com/ScriptReference/',
    [1]: 'https://docs.unity3d.com/Manual/'
}

let browser;
let translate;
// 启动浏览器
(async function () {
    browser = await puppeteer.launch();
    translate = await browser.newPage();
    await translate.goto(encodeURI('https://translate.google.com/'));
})();

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
    if (!browser) {
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

    const page = await browser.newPage();

    const watchDogResults = page.waitForSelector('.search-results .result');
    const watchDogNotResult = page.waitForFunction('document.querySelector(".search-results")&&/did not result/ig.test(document.querySelector(".search-results").textContent)');

    const searchText = recvObj.params.content.replace(/\[.*?\]|api|手.*册/g, '').trim();
    try {
        await translate.goto(encodeURI(`https://translate.google.com/#view=home&op=translate&sl=auto&tl=en&text=${searchText}`));
        searchText = await translate.evaluate(() => {
            return document.querySelector('.tlid-translation.translation').textContent;
        });
    } catch {}
    console.log('Unity Documentation search:', searchText);

    let pageWait = page.goto(encodeURI(`${DocUrl[type]}30_search.html?q=${searchText}`), {
        waitUntil: 'networkidle2'
    });

    try {
        await Promise.race([watchDogResults, watchDogNotResult, pageWait]);
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
        if (/did not result/ig.test(document.querySelector(".search-results").textContent)) {
            return null;
        }

        const resultElements = document.querySelectorAll('.search-results .result');

        const retArr = [];
        for (let i = 0; i < 5; i++) {
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