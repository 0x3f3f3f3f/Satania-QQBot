const key = Buffer.from('satania');

/**
 * 加密
 */
module.exports = {
    /**
     * XOR
     * @param {Buffer} buffer 
     */
    XOR(buffer) {
        const encryptedBuffer = Buffer.alloc(buffer.length);
        for (let i = 0; i < buffer.length; i++) {
            encryptedBuffer[i] = buffer[i] ^ key[i % key.length];
        }
        return encryptedBuffer;
    }
}