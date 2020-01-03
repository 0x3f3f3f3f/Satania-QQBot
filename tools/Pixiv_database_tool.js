const _ = require('lodash');
require('colors');
const fs = require('fs');

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

const argTableName = process.argv[2];
const argID1 = parseInt(process.argv[4]);
const argID2 = parseInt(process.argv[5]);

async function insert(srcID, dstID) {
    const src = (await knex(argTableName).where('id', srcID))[0];
    await del(srcID);
    let index = dstID;
    let temp = (await knex(argTableName).where('id', index))[0];
    for (;;) {
        index++;
        const temp2 = (await knex(argTableName).where('id', index))[0];
        if (!_.isEmpty(temp2)) {
            delete temp.id;
            await knex(argTableName).where('id', index).update(temp);
            temp = temp2;
        } else {
            temp.id = index;
            await knex(argTableName).insert(temp);
            break;
        }
    }
    delete src.id;
    await knex(argTableName).where('id', dstID).update(src);
}

async function del(id) {
    await knex(argTableName).where('id', id).delete();
    let index = id;
    for (;;) {
        index++;
        if (!(await knex(argTableName).where('id', index).update('id', index - 1))) {
            break;
        }
    }
}

(async function () {
    if (!_.isUndefined(argTableName)) {
        switch (process.argv[3]) {
            case 'i':
                if (_.isNaN(argID1) ||
                    _.isNaN(argID2)) {
                    console.log('Arguments is incorrect!'.red.bold);
                    break;
                }
                await insert(argID1, argID2);
                break;
            case 'd':
                if (_.isNaN(argID1)) {
                    console.log('Arguments is incorrect!'.red.bold);
                    break;
                }
                await del(argID1);
                break;
            default:
                console.log('Arguments is incorrect!'.red.bold);
                break;
        }
    } else {
        console.log('Table name is incorrect!'.red.bold);
    }
    process.exit();
})();