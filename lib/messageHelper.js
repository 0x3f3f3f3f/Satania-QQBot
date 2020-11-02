module.exports = {
    flat(message) {
        const arr = [];
        for (const msg of message) {
            switch (msg.type) {
                case 'Source':
                    break;
                case 'Quote':
                    arr.push('[引用]');
                    break;
                case 'At':
                    arr.push(msg.display);
                    break;
                case 'AtAll':
                    arr.push('[@全体成员]');
                    break;
                case 'Face':
                    arr.push('[表情]');
                    break;
                case 'Plain':
                    arr.push(msg.text);
                    break;
                case 'Image':
                    arr.push('[图片]');
                    break;
                case 'FlashImage':
                    arr.push('[闪照]');
                    break;
                case 'Voice':
                    arr.push('[语音]');
                    break;
                case 'Xml':
                    arr.push(msg.xml);
                    break;
                case 'Json':
                    arr.push(msg.json);
                    break;
                case 'Poke':
                    arr.push('[戳一戳]');
                    break;
                default:
                    arr.push('[未知类型消息]');
                    break;
            }
        }
        return arr.join('');
    },
    getText(message) {
        const arr = [];
        for (const msg of message) {
            if (msg.type == 'Plain') {
                arr.push(msg.text);
            }
        }
        return arr.join('');
    },
    getImage(message) {
        for (const msg of message) {
            if (msg.type == 'Image') {
                return msg.url;
            }
        }
    },
    getAt(message) {
        for (const msg of message) {
            if (msg.type == 'At') {
                return msg.target;
            }
        }
    }
}