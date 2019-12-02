const _ = require('lodash');
require('colors');
const fs = require('fs');

const secret = JSON.parse(fs.readFileSync('../secret.json', 'utf8'));

const knex = require('knex')({
    client: 'mysql2',
    connection: {
        host: secret.mysqlHost,
        user: secret.mysqlUser,
        password: secret.mysqlPassword,
        database: secret.mysqlDatabase
    }
});

async function insert(srcID, dstID) {
    const src = await knex('user_tags').where('id', srcID);
    await del(srcID);
    let index = dstID;
    let temp = await knex('user_tags').where('id', index);
    for (;;) {
        index++;
        try {
            const temp2 = await knex('user_tags').where('id', index);
            delete temp.id;
            await knex('user_tags').where('id', index).update(temp);
            temp = temp2;
        } catch {
            delete temp.id;
            await knex('user_tags').insert(temp);
            break;
        }
    }
    delete src.id;
    await knex('user_tags').where('id', dstID).update(src);
}

async function del(id) {
    await knex('user_tags').where('id', id).delete();
    let index = id;
    for (;;) {
        index++;
        try {
            await knex('user_tags').where('id', index).update('id', index - 1);
        } catch {
            break;
        }
    }
}

const argID1 = parseInt(process.argv[3]);
const argID2 = parseInt(process.argv[4]);

(async function () {
    switch (process.argv[2]) {
        case 'i':
            if (_.isNaN(argID1) ||
                _.isNaN(argID2)) {
                console.log('Arguments input is incorrect!'.red.bold);
                break;
            }
            await insert(argID1, argID2);
            break;
        case 'd':
            if (_.isNaN(argID1)) {
                console.log('Arguments input is incorrect!'.red.bold);
                break;
            }
            await del(argID1);
            break;
        default:
            console.log('Arguments input is incorrect!'.red.bold);
            break;
    }
    process.exit();
})();