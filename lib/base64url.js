/**
 * Base64 url安全编码
 */
module.exports = {
    /**
     * @param {string} data 
     */
    encode(data) {
        return data.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
}