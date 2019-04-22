const fs = require('fs');
const _ = require('lodash');

const secret = JSON.parse(fs.readFileSync('../secret.json', 'utf8'));

const knex = require('knex')({
    client: 'mysql2',
    connection: {
        host: secret.mysqlHost,
        port: secret.mysqlPort,
        user: secret.mysqlUser,
        password: secret.mysqlPassword,
        database: secret.mysqlDatabase
    }
});

async function getInsideTags() {
    const insideTags = await knex('inside_tags').select('type', 'tag');
    const tagList = {};
    for (const insideTag of insideTags) {
        if (!_.isArray(tagList[insideTag.type])) tagList[insideTag.type] = [];
        tagList[insideTag.type].push(insideTag.tag);
    }
    return tagList;
}

(async function () {
    const tagList = await getInsideTags();
    let text = ''
    for (const key in tagList) {
        text += key + ':\n';
        text += tagList[key].join() + '\n'
    }
    fs.writeFileSync('inside_tags.txt', text);
    process.exit();
})();