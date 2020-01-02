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
    if (!(await knex.schema.hasColumn('users', 'group'))) {
        await knex.schema.table('users', table => {
            table.string('group');
        });
    }
    if (!(await knex.schema.hasColumn('user_tags', 'enabled'))) {
        await knex.schema.table('user_tags', table => {
            table.boolean('enabled').index('enabled').defaultTo(true);
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

// 支持跨域
// app.all('*', (req, res, next) => {
//     res.header('Access-Control-Allow-Origin', '*');
//     res.header('Access-Control-Allow-Headers', 'Content-Type');
//     next();
// });

// 获得用户名
app.post('/getUserName', async (req, res) => {
    if ((!_.isString(req.body.userKey) || /^\s*$/.test(req.body.userKey))) {
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
    if ((!_.isString(req.body.userKey) || /^\s*$/.test(req.body.userKey)) ||
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

    if (/^\s*$/.test(req.body.userName)) {
        res.json({
            err: '用户名不能为空'
        });
        return;
    }

    user.name = req.body.userName;
    await knex('users').where('account', account).update(user);
    res.json({
        result: true,
        nextUrl: encodeURI('edit.html?key=' + req.body.userKey)
    });
});

// 获得所有用户标签
app.post('/getUserTags', async (req, res) => {
    // if ((!_.isString(req.body.userKey) || /^\s*$/.test(req.body.userKey))) {
    //     res.json({
    //         err: true
    //     });
    //     return;
    // }

    let account;
    try {
        account = Buffer.from(req.body.userKey, 'base64').toString('utf8');
    } catch {
        // res.json({
        //     err: '用户密钥错误'
        // });
        // return;
        account = '';
    }

    let user = (await knex('users').where('account', account))[0];
    if (_.isEmpty(user)) {
        // res.json({
        //     err: '用户未注册'
        // });
        // return;
        user = {};
    }

    const userTags = await knex('user_tags').leftJoin('users', 'user_tags.account', 'users.account')
        .select(
            'enabled',
            'user_tags.id as id',
            'users.name as userName',
            'type',
            'match',
            'user_tags.raw_tags as rawTags',
            'comment',
            'group'
        );

    let editableList;
    if (user.group == 'admin') {
        editableList = await knex('user_tags').select('id');
    } else {
        editableList = await knex('user_tags').where('account', account).select('id');
    }

    for (const userTag of userTags) {
        userTag.editable = false;
        for (const editableTag of editableList) {
            if (editableTag.id == userTag.id) {
                userTag.editable = true;
                break;
            }
        }
    }

    if (!_.isEmpty(user)) {
        userTags.push({
            id: -1,
            enabled: true,
            userName: '',
            type: 'string',
            match: '',
            rawTags: '',
            comment: '',
            editable: true
        });
    } else {
        userTags.push({
            id: -1,
            editable: false
        });
    }

    res.json({
        result: true,
        userTags
    });
});

// 用户编辑标签
app.post('/setUserTag', async (req, res) => {
    if ((!_.isString(req.body.userKey) || /^\s*$/.test(req.body.userKey)) ||
        (_.isObject(req.body.userTag) && (
            !_.isBoolean(req.body.userTag.enabled) ||
            !_.isString(req.body.userTag.type) ||
            !_.isString(req.body.userTag.match) ||
            !_.isString(req.body.userTag.rawTags) ||
            !_.isString(req.body.userTag.comment)))) {
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

    const user = (await knex('users').where('account', account))[0];
    if (_.isEmpty(user)) {
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

    if (/^\s*$/.test(req.body.userTag.match) ||
        /^\s*$/.test(req.body.userTag.rawTags)) {
        res.json({
            err: '规则或标签为空'
        });
        return;
    }
    const rawTags = req.body.userTag.rawTags.split(',');
    for (;;) {
        let needTrim = false;
        if (rawTags[0] == '|' || rawTags[0] == '&') {
            needTrim = true;
            rawTags.shift();
        }
        if (rawTags[rawTags.length - 1] == '|' ||
            rawTags[rawTags.length - 1] == '&') {
            needTrim = true;
            rawTags.pop();
        }
        if (!needTrim) break;
    }

    if (/^\s*$/.test(req.body.userTag.comment)) {
        req.body.userTag.comment = '';
    }

    if (!_.isNumber(req.body.userTag.id)) {
        // 新建
        await knex('user_tags').insert({
            enabled: req.body.userTag.enabled,
            account,
            type,
            match: req.body.userTag.match,
            raw_tags: rawTags.join(),
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
        if (user.group != 'admin' && userTag.account != account) {
            res.json({
                err: '你不能编辑其他用户的标签'
            });
            return;
        }
        await knex('user_tags').where('id', req.body.userTag.id).update({
            enabled: req.body.userTag.enabled,
            type,
            match: req.body.userTag.match,
            raw_tags: rawTags.join(),
            comment: req.body.userTag.comment
        });
    }
    res.json({
        result: true
    });
});

module.exports = function () {
    app.listen(port, secret.httpHost);
}