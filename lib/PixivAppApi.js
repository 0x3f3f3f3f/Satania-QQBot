const request = require('request');
const {
    EventEmitter
} = require('events');

const errorCode = {
    LoginFail: -1,
    NetError: 1,
    RateLimit: 2,
    OffestLimit: 3,
    NoExist: 4,
    NoNextPage: 5,
    UnknowError: 127
}

function postAsync(_path, json) {
    return new Promise((resolve, reject) => {
        request.post(`${secret.pixivpyUrl}${_path}`, {
            json
        }, (err, res, body) => {
            if (err || body.code != 0) {
                if (body.code == -1) reject(errorCode.LoginFail);
                else reject(errorCode.NetError);
                return;
            }
            resolve(body.json_result);
        });
    });
}

module.exports = {
    PixivAppApi: class {
        /**
         * PixivAppApi
         * @param {string} username 
         * @param {string} password 
         */
        constructor(username, password) {
            this.username = username;
            this.password = password;
            this.isReady = true;
            this.rEvent = new EventEmitter();
            this.hasNext = false;
            this.lastPath = '';
            this.nextOption = {};
        }

        login() {
            return postAsync('/login', {
                username: this.username,
                password: this.password
            });
        }

        async searchIllust(option) {
            const res = await postAsync('/search_illust', {
                username: this.username,
                ...option
            });

            if (res.error) {
                const errMsg = res.error.message || res.error.user_message;
                if (/rate limit/i.test(errMsg)) {
                    throw errorCode.RateLimit;
                } else if (/offset.*?more than/i.test(errMsg)) {
                    throw errorCode.OffestLimit;
                } else if (/deleted.*?not exist/i.test(errMsg)) {
                    throw errorCode.NoExist;
                } else {
                    throw errorCode.UnknowError;
                }
            }

            if (res.next_url) {
                const next_url = new URL(res.next_url);
                const option = {};
                next_url.searchParams.forEach((value, key) => {
                    option[key] = value;
                });
                this.lastPath = '/search_illust';
                this.nextOption = option;
                this.hasNext = true;
            } else {
                this.hasNext = false;
            }

            return res;
        }

        /**
         * illustDetail
         * @param {Number} illust_id 
         */
        async illustDetail(illust_id) {
            const res = await postAsync('/illust_detail', {
                username: this.username,
                illust_id
            });

            if (res.error) {
                const errMsg = res.error.message || res.error.user_message;
                if (/rate limit/i.test(errMsg)) {
                    throw errorCode.RateLimit;
                } else if (/offset.*?more than/i.test(errMsg)) {
                    throw errorCode.OffestLimit;
                } else if (/deleted.*?not exist/i.test(errMsg)) {
                    throw errorCode.NoExist;
                } else {
                    throw errorCode.UnknowError;
                }
            }

            return res;
        }

        async next() {
            if (!this.hasNext) {
                throw errorCode.NoNextPage;
            }

            const res = await postAsync(this.lastPath, {
                username: this.username,
                ...this.nextOption
            });

            if (res.error) {
                const errMsg = res.error.message || res.error.user_message;
                if (/rate limit/i.test(errMsg)) {
                    throw errorCode.RateLimit;
                } else if (/offset.*?more than/i.test(errMsg)) {
                    throw errorCode.OffestLimit;
                } else if (/deleted.*?not exist/i.test(errMsg)) {
                    throw errorCode.NoExist;
                } else {
                    throw errorCode.UnknowError;
                }
            }

            if (res.next_url) {
                const next_url = new URL(res.next_url);
                const option = {};
                next_url.searchParams.forEach((value, key) => {
                    option[key] = value;
                });
                this.nextOption = option;
                this.hasNext = true;
            } else {
                this.hasNext = false;
            }

            return res;
        }

        startRecover() {
            if (this.isReady) {
                this.isReady = false;
                setTimeout(() => {
                    this.isReady = true;
                    this.rEvent.emit('recovered');
                }, 300000);
            }
        }

        async recover() {
            if (this.isReady) return this;

            await new Promise(resolve => {
                this.rEvent.once('recovered', resolve);
            });
            return this;
        }
    },
    errorCode
}