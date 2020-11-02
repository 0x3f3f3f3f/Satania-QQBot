const _ = require('lodash');

module.exports = {
    friend: 1,
    group: 2,
    groupNonFriend: 3,
    discuss: 4,
    discussNonFriend: 5,
    nonFriend: 6,
    convert(type, sub) {
        if (_.isNumber(type)) {
            switch (type) {
                case 1:
                    return 'private';
                case 2:
                    return 'group';
                case 3:
                    return 'private';
                case 4:
                    return '';
                case 5:
                    return '';
                case 6:
                    return 'private';
                default:
                    return '';
            }
        }
        switch (type) {
            case 'private':
                switch (sub) {
                    case 'friend':
                        return 1;
                    case 'group':
                        return 3;
                    case 'other':
                        return 6;
                    default:
                        return 6;
                };
            case 'group':
                switch (sub) {
                    case 'normal':
                        return 2;
                    case 'anonymous':
                        return 2;
                    case 'notice':
                        return 2;
                    default:
                        return 2;
                };
            default:
                return 0;
        }
    }
}