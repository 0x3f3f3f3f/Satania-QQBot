const fs = require('fs');
const PixivAppApi = require('pixiv-app-api');

const secret = JSON.parse(fs.readFileSync('./secret.json', 'utf8'));

const pixiv = new PixivAppApi(secret.PixivUserName, secret.PixivPassword, {
    camelcaseKeys: true
});

const knex = require('knex')({
    client: 'mysql2',
    connection: {
        host: secret.mysqlHost,
        user: secret.mysqlUser,
        password: secret.mysqlPassword,
        database: secret.mysqlDatabase
    }
});

async function initDatabase() {
    if (!(await knex.schema.hasTable('illusts'))) {
        await knex.schema.createTable('illusts', table => {
            table.integer('id').unsigned().primary();
        });
    }

    if (!(await knex.schema.hasColumn('illusts', 'title'))) {
        await knex.schema.table('illusts', table => {
            table.string('title');
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'image_url'))) {
        await knex.schema.table('illusts', table => {
            table.string('image_url', 2048);
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'user_id'))) {
        await knex.schema.table('illusts', table => {
            table.integer('user_id').unsigned();
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'tags'))) {
        await knex.schema.table('illusts', table => {
            table.string('tags');
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'create_date'))) {
        await knex.schema.table('illusts', table => {
            table.dateTime('create_date');
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'width'))) {
        await knex.schema.table('illusts', table => {
            table.integer('width').unsigned();
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'height'))) {
        await knex.schema.table('illusts', table => {
            table.integer('height').unsigned();
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'total_view'))) {
        await knex.schema.table('illusts', table => {
            table.integer('total_view').unsigned();
        });
    }
    if (!(await knex.schema.hasColumn('illusts', 'total_bookmarks'))) {
        await knex.schema.table('illusts', table => {
            table.integer('total_bookmarks').unsigned();
        });
    }

    console.log('database init finished');
}

(async function () {
    await initDatabase();
    const pixivTrendTags = await pixiv.trendingTagsIllust();
    console.log(pixivTrendTags);
})();