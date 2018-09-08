'use strict';

var wtf = require('../index'),
    cluster = require('cluster');

if (cluster.isMaster) {
    var worker = cluster.fork();
    worker.on('online', function () {
        wtf.dump();
    });
} else {
    wtf.dump();
    process.exit();
}