const moment = require('moment');
const childProcess = require('child_process');
const _ = require('lodash');
require('colors');

const cmd = _.isUndefined(process.argv[2]) ? null : process.argv[2];
if (!cmd) {
    console.error('Command is NULL!'.red.bold);
    return;
}
const hour = _.isUndefined(process.argv[3]) ? 23 : parseInt(process.argv[3]);
const minute = _.isUndefined(process.argv[4]) ? 45 : parseInt(process.argv[4]);

let day = -1;

const minTimer = setInterval(() => {
    const curTime = moment();
    if (day != curTime.day() && curTime.hour() == hour && curTime.minute() == minute) {
        day = curTime.day();
        console.log(childProcess.execSync(cmd).toString('utf8'));
        console.log('Restart app at ', curTime.format('YYYY-MM-DD HH:mm:ss.SSS'));
    }
}, 60000);