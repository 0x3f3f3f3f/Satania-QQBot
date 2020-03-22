const createProxyMiddleware = require('http-proxy-middleware').createProxyMiddleware;

module.exports = createProxyMiddleware({
    target: secret.evaluateCodeUrl,
    changeOrigin: true
});