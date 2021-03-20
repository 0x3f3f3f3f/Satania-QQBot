const _ = require('lodash');

module.exports = {
    FriendMessage: 1,
    GroupMessage: 2,
    TempMessage: 3,
    convert(type) {
        switch (type) {
            case 'FriendMessage':
                return 1;
            case 'GroupMessage':
                return 2;
            case 'TempMessage':
                return 3;
            default:
                return 0;
        }
    }
}