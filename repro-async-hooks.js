var http = require('http');

function runServerProcess() {
    var server;
    var shutdown = false;

    process.on('message', function onMessage(msg) {
        if (msg === 'shutdown') {
            shutdown = true;

            if (server) {
                server.close();
                process.disconnect();
            }
        }
    });

    if (!shutdown) {
        server = http.createServer(function onRequest(req, res) {
            res.end();
        });

        server.listen(function onServerListen() {
            process.send({
                code: 'SERVER_READY',
                port: server.address().port
            });
        });
    }
}

function runClientsProcess() {
    var assert = require('assert');
    var asyncHooks = require('async_hooks');
    var asyncWrap = process.binding('async_wrap');
    var child_process = require('child_process');

    var req;

    var httpParserUids = [];
    var uidsPerRequestResponseCycle = [];
    var currentRequestResponseCycle = 0;

    process.on('exit', function onExit() {
        console.log('uids per request/response cycle:',
            uidsPerRequestResponseCycle);

        assert.strictEqual(uidsPerRequestResponseCycle.length, 2);
        assert.notEqual(uidsPerRequestResponseCycle[0],
            uidsPerRequestResponseCycle[1]);
    });

    function asyncHookInit(uid, provider, parentUid, handle) {
        if (provider === 'PARSER') {
            console.log('INIT uid: %s, provider: %s', uid, provider);
            httpParserUids.push(uid);
        }
    }

    function asyncHookBefore(uid) {
        if (httpParserUids.indexOf(uid) !== -1) {
            console.log('PRE uid: %s', uid);
            uidsPerRequestResponseCycle[currentRequestResponseCycle] = uid;
        }
    }

    function asyncHookAfter(uid, didThrow) {
        if (httpParserUids.indexOf(uid) !== -1) {
            console.log('POST uid: %s, didThrow: %s', uid, didThrow);
        }
    }

    function asyncHookDestroy(uid) {
        if (httpParserUids.indexOf(uid) !== -1) {
            console.log('DESTROY uid: %s', uid);
        }
    }

    asyncHooks.createHook({
        init: asyncHookInit,
        before: asyncHookBefore,
        after: asyncHookAfter,
        destroy: asyncHookDestroy
    }).enable();

    var args = [__filename, 'child'];

    child = child_process.spawn(process.execPath, args, {
        stdio: ['ipc', 'pipe', 'pipe']
    });

    child.on('message', function onMessage(msg) {
        var serverPort;

        if (msg.code === 'SERVER_READY') {
            serverPort = msg.port;

            var req = http.request({
                hostname: 'localhost',
                port: serverPort
            }, function onFirstResponse(res) {
                ++currentRequestResponseCycle;

                var req = http.request({
                    hostname: 'localhost',
                    port: serverPort
                }, function onSecondResponse(res) {
                    child.send('shutdown');
                });

                req.end();
            });

            req.end();
        }
    });
}

if (process.argv[2] === 'child') {
    runServerProcess();
} else {
    runClientsProcess();
}
