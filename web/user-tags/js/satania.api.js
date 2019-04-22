const SataniaAPI = {
    notFoundUrl = '/',
    async _post(url, data) {
        let result = null;
        try {
            result = await new Promise((resovle, reject) => {
                $.ajax({
                    url,
                    method: 'POST',
                    dataType: 'json',
                    contentType: "application/json",
                    data: JSON.stringify(data)
                }).done(res => {
                    resovle(res);
                }).fail((xhr, status, errorThrown) => {
                    reject(errorThrown);
                });
            });
        } catch {
            alert('网络发生错误');
        }
        return result;
    },
    async getUserName(userKey) {
        const result = await this._post('/api/getUserName', {
            userKey
        });

        if (result.err == true) {
            location.href = this.notFoundUrl;
        } else if (result.err) {
            alert(result.err);
        }

        return result;
    },
    async login(userKey, userName) {
        const result = await this._post('/api/login', {
            userKey,
            userName
        });

        if (result.err == true) {
            alert('发生错误');
        } else if (result.err) {
            alert(result.err);
        }

        return result;
    },
    async getUserTags(userKey) {
        const result = await this._post('/api/getUserTags', {
            userKey
        });

        if (result.err == true) {
            location.href = this.notFoundUrl;
        } else if (result.err) {
            alert(result.err);
        }

        return result;
    },
    async setUserTag(userKey, userTag) {
        const result = await this._post('/api/setUserTag', {
            userKey,
            userTag
        });

        if (result.err == true) {
            alert('发生错误');
        } else if (result.err) {
            alert(result.err);
        }

        return result;
    }
}