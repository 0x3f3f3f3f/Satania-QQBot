const messageHelper = require('../libs/messageHelper');

function parseJson(recvObj, json) {
    try {
        const obj = JSON.parse(json);
        if (obj && /哔哩哔哩/.test(obj.prompt)) {
            let metaData;
            for (const key in obj.meta) {
                metaData = obj.meta[key];
                break;
            }
            const message = [{
                    type: 'Plain',
                    text: metaData.desc
                },
                {
                    type: 'Plain',
                    text: '\n'
                },
                {
                    type: 'Image',
                    url: metaData.preview.startsWith('http') ? metaData.preview : 'http://' + metaData.preview
                },
                {
                    type: 'Plain',
                    text: '\n'
                },
                {
                    type: 'Plain',
                    text: metaData.qqdocurl
                }
            ];
            sendMsg(recvObj, message);
        }
    } catch {}
}

function parseXml(recvObj, xml) {
    const biliSign = xml.match(/brief\=\"(.*?)\"/);
    if (!(biliSign && /哔哩哔哩/.test(biliSign[1]))) return;
    const title = xml.match(/\<summary\>(.*?)\<\/summary\>/);
    const pic = xml.match(/\<picture cover\=\"(.*?)\"/);
    const url = xml.match(/\<source url\=\"(.*?)\"/);
    if (title && pic && url) {
        const message = [{
                type: 'Plain',
                text: title[1]
            },
            {
                type: 'Plain',
                text: '\n'
            },
            {
                type: 'Image',
                url: pic[1]
            },
            {
                type: 'Plain',
                text: '\n'
            },
            {
                type: 'Plain',
                text: url[1]
            }
        ];
        sendMsg(recvObj, message);
    }
}

module.exports = function (recvObj) {
    const msgXml = messageHelper.getXml(recvObj.message);
    const msgJson = messageHelper.getJson(recvObj.message);
    const msgApp = messageHelper.getApp(recvObj.message);

    if (msgXml && /^\</.test(msgXml)) {
        parseXml(recvObj, msgXml);
        return true;
    }
    if (msgJson && /^\{/.test(msgJson)) {
        parseJson(recvObj, msgJson);
        return true;
    }
    if (msgApp && /^\</.test(msgApp)) {
        parseXml(recvObj, msgApp);
        return true;
    }
    if (msgApp && /^\{/.test(msgApp)) {
        parseJson(recvObj, msgApp);
        return true;
    }
    return false;
}