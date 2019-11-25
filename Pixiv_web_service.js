const express = require('express');
const _ = require('lodash');

// 连接数据库
const knex = require('knex')({
    client: 'mysql2',
    connection: {
        host: secret.mysqlHost,
        user: secret.mysqlUser,
        password: secret.mysqlPassword,
        database: secret.mysqlDatabase
    }
});

(async function () {
    if (!(await knex.schema.hasTable('users'))) {
        await knex.schema.createTable('users', table => {
            table.increments('id').primary();
        });
    }
    if (!(await knex.schema.hasTable('user_tags'))) {
        await knex.schema.createTable('user_tags', table => {
            table.increments('id').primary();
        });
    }

    if (!(await knex.schema.hasColumn('users', 'account'))) {
        await knex.schema.table('users', table => {
            table.string('account').index('account');
        });
    }
    if (!(await knex.schema.hasColumn('users', 'name'))) {
        await knex.schema.table('users', table => {
            table.string('name');
        });
    }
    if (!(await knex.schema.hasColumn('user_tags', 'account'))) {
        await knex.schema.table('user_tags', table => {
            table.string('account').index('account');
        });
    }
    if (!(await knex.schema.hasColumn('user_tags', 'type'))) {
        await knex.schema.table('user_tags', table => {
            table.string('type');
        });
    }
    if (!(await knex.schema.hasColumn('user_tags', 'match'))) {
        await knex.schema.table('user_tags', table => {
            table.string('match');
        });
    }
    if (!(await knex.schema.hasColumn('user_tags', 'raw_tags'))) {
        await knex.schema.table('user_tags', table => {
            table.string('raw_tags');
        });
    }
    if (!(await knex.schema.hasColumn('user_tags', 'comment'))) {
        await knex.schema.table('user_tags', table => {
            table.string('comment');
        });
    }
})();

const app = express();
const port = 33000;

app.use(express.json());

// 获得用户名
app.post('/getUserName', async (req, res) => {
    if (!_.isString(req.body.userKey)) {
        res.json({
            err: true
        });
        return;
    }

    let account;
    try {
        account = Buffer.from(req.body.userKey, 'base64').toString('utf8');
    } catch {
        res.json({
            err: '用户密钥错误'
        });
        return;
    }

    const user = (await knex('users').where('account', account).select('name'))[0];
    if (_.isEmpty(user)) {
        res.json({
            err: '用户未注册'
        });
        return;
    }

    res.json({
        result: true,
        userName: user.name
    })
});

// 登录
app.post('/login', async (req, res) => {
    if (!_.isString(req.body.userKey) ||
        !_.isString(req.body.userName)) {
        res.json({
            err: '参数不正确'
        });
        return;
    }

    let account;
    try {
        account = Buffer.from(req.body.userKey, 'base64').toString('utf8');
    } catch {
        res.json({
            err: '用户密钥错误'
        });
        return;
    }

    const user = (await knex('users').where('account', account).select('name'))[0];
    if (_.isEmpty(user)) {
        res.json({
            err: '用户未注册'
        });
        return;
    }

    user.name = req.body.userName;
    await knex('users').where('account', account).update(user);
    res.json({
        result: true,
        nextUri: '/edit.html?key=' + req.body.userKey
    });
});

// 获得所有用户标签
app.get('/getUserTags', async (req, res) => {
    const userTags = await knex('user_tags').leftJoin('users', 'user_tags.account', 'users.account')
        .select(
            'user_tags.id as id',
            'users.name as userName',
            'type',
            'match',
            'user_tags.raw_tags as rawTags',
            'comment'
        );
    res.json({
        result: true,
        userTags
    });
});

// 用户编辑标签
app.post('/setUserTag', async (req, res) => {
    if (!_.isString(req.body.userKey) ||
        (_.isObject(req.body.userTag) && (
            !_.string(req.body.userTag.type) ||
            !_.string(req.body.userTag.match) ||
            !_.string(req.body.userTag.rawTags) ||
            !_.string(req.body.userTag.comment)))) {
        res.json({
            err: '参数不正确'
        });
        return;
    }

    let account;
    try {
        account = Buffer.from(req.body.userKey, 'base64').toString('utf8');
    } catch {
        res.json({
            err: '用户密钥错误'
        });
        return;
    }

    if (_.isEmpty((await knex('users').where('account', account))[0])) {
        res.json({
            err: '用户未注册'
        });
        return;
    }

    let type;
    switch (req.body.userTag.type) {
        case 'regexp':
            type = 'regexp';
            break;
        case 'string':
            type = 'string';
            break;
        default:
            res.json({
                err: '用户标签类型错误'
            });
            return;
    }

    if (!_.isNumber(req.body.userTag.id)) {
        // 新建
        await knex('user_tags').insert({
            account,
            type,
            match: req.body.userTag.match,
            raw_tags: req.body.userTag.rawTags,
            comment: req.body.userTag.comment
        });
    } else {
        // 更新
        let userTag = (await knex('user_tags').where('id', req.body.userTag.id))[0];
        if (_.isEmpty(userTag)) {
            res.json({
                err: 'ID不存在'
            });
            return;
        }
        if (userTag.account != account) {
            res.json({
                err: '你不能修其他用户的标签'
            });
            return;
        }
        await knex('user_tags').where('id', req.body.userTag.id).update({
            type,
            match: req.body.userTag.match,
            raw_tags: req.body.userTag.rawTags,
            comment: req.body.userTag.comment
        });
    }
    res.json({
        result: true
    });
});

app.all('*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
});

module.exports = function () {
    app.listen(port, '127.0.0.1');
}