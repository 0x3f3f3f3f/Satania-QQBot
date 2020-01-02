const fs = require('fs');
const _ = require('lodash');
const puppeteer = require('puppeteer');

const DocUrl = {
    [0]: 'https://docs.unity3d.com/ScriptReference/',
    [1]: 'https://docs.unity3d.com/Manual/'
}

let isInitialized = false;

// 启动浏览器
let browser;
(async function () {
    if (!fs.existsSync(secret.chromiumUserData))
        fs.mkdirSync(secret.chromiumUserData, {
            recursive: true
        });
    browser = await puppeteer.launch({
        userDataDir: secret.chromiumUserData,
        //headless模式加载缓慢的解决办法 https://github.com/GoogleChrome/puppeteer/issues/1718
        args: [
            '--proxy-server="direct://"',
            '--proxy-bypass-list=*',
            '--no-sandbox'
        ]
    });
    isInitialized = true;
    // 让最开始打开的页面始终在前面
    browser.on('targetcreated', async () => {
        const pages = await browser.pages();
        if (pages[1]) await pages[1].bringToFront();
    });
})();

module.exports = async function (req, res) {
    const type = req.body.type;
    let searchText = req.body.text;

    if (!isInitialized) {
        res.json({
            err: 'noready'
        });
        return;
    }

    // 含有非英语，需要翻译
    if (/[^\u0000-\u007F]/.test(searchText)) {
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
    }

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
        res.json({
            err: 'neterr'
        });
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

        res.json({
            results,
            infoText
        });
    } else {
        res.json({
            err: 'nofind'
        });
    }
}