#!/usr/bin/env node

'use strict';

var Socket, Server, Timer;

// hook stuff
(function () {
    var _Error_prepareStackTrace = Error.prepareStackTrace;
    var hooked = function (_, stack) { return stack; };
    
    Object.defineProperty(global, '__stack', {
        get: function(){
            Error.prepareStackTrace = hooked
            var err = new Error();
            var stack = err.stack.map(function (item) {
                return {
                    file: item.getFileName(),
                    line: item.getLineNumber()
                };
            });
            Error.prepareStackTrace = _Error_prepareStackTrace;
            return stack;
        }
    });

    // timers call this
    var L = require('_linklist');
    var _L_append = L.append;
    L.append = function (list, item) {
        if (list instanceof Timer) {
            if (item && typeof item._onTimeout === 'function') {
                item._onTimeout.__callSite = item._repeat ? __stack[5] : __stack[6];
            } else {
                console.log('Uncertain what to do with item:', item);
            }
        }
        return _L_append.apply(this, arguments);
    };

    var EventEmitter = require('events').EventEmitter;
    var _EventEmitter_addListener = EventEmitter.prototype.addListener;

    EventEmitter.prototype.on =
    EventEmitter.prototype.addListener = function (type, listener) {
        var stack = __stack;
        listener.__fullStack = stack;
        if (stack[3].file === 'events.js') {
            listener.__callSite = stack[6]; // inline listener binding on net.connect
        }
        else if (/express\/lib\/application\.js$/.test(stack[4].file)) {
            listener.__callSite = stack[5]; // express 4
        }
        else if (stack[3].file === 'http.js') {
            listener.__callSite = stack[4]; // http.createServer(fn)
        }
        else {
            listener.__callSite = stack[3];
        }
        
        return _EventEmitter_addListener.apply(this, arguments);
    };
})();

Socket = require('net').Socket;
Server = require('net').Server;
Timer = process.binding('timer_wrap').Timer;

function formatTime(t) {
    var labels = ['ms', 's', 'min', 'hr'],
        units = [1, 1000, 60, 60],
        i = 0;
    
    while (i < units.length && t / units[i] > 1) { t /= units[i++]; }
    return Math.floor(t) + ' ' + labels[i-1];
};

process.on('SIGINT', function () {
    console.log('[WTF Node?] open handles:');
    
    var sockets = [ ], servers = [ ], _timers = [ ], other = [ ];
    process._getActiveHandles().forEach(function (h) {
        if (h instanceof Socket) { sockets.push(h); }
        else if (h instanceof Server) { servers.push(h); }
        else if (h instanceof Timer) { _timers.push(h); }
        else { other.push(h); }
    });
    
    if (sockets.length) {
        console.log('- Sockets:');
        sockets.forEach(function (s) {
            if (s.destroyed) {
                console.log('  - (?:?) -> %s:? (destroyed)', s._host);
            } else {
                console.log('  - %s:%s -> %s:%s', s.localAddress, s.localPort, s.remoteAddress, s.remotePort);
            }
            var connectListeners = s.listeners('connect');
            if (connectListeners) {
                console.log('    - Listeners:');
                connectListeners.forEach(function (fn) {
                    console.log('      - %s: %s @ %s:%d', 'connect', fn.name, fn.__callSite.file, fn.__callSite.line);
                });
            }
        });
    }
    
    if (servers.length) {
        console.log('- Servers:');
        servers.forEach(function (s) {
            var a = s.address();
            console.log('  - %s:%s', a.address, a.port);

            var connectListeners = s.listeners('connection');
            if (connectListeners) {
                console.log('    - Listeners:');
                connectListeners.forEach(function (fn) {
                    //console.log(fn.__fullStack);
                    console.log('      - %s: %s @ %s:%d', 'connection', fn.name, fn.__callSite.file, fn.__callSite.line);
                });
            }
        });
    }
    
    var timers = [ ];
    _timers.forEach(function (t) {
        var timer = t;
        while ((timer = timer._idleNext)) {
            if (timer === t) {
                break;
            }
            if (timer._onTimeout && timers.indexOf(t) === -1) {
                timers.push(timer);
            }
        }
        
    });
    
    if (timers.length) {
        console.log('- Timers:');
        
        timers.forEach(function (t) {
            var fn = t._onTimeout;
            console.log('  - (%d ~ %s) %s @ %s:%d', t._idleTimeout, formatTime(t._idleTimeout), fn.name, fn.__callSite.file, fn.__callSite.line);
        });
    }
    
    if (other.length) {
        console.log('- Others:');
        other.forEach(function (o) {
            if (!o) { return; }
            if (o.constructor) { console.log('  - %s', o.constructor.name); }
            else { console.log('  - %s', o); }
        });
    }
    
    process.exit();
});

if (module === require.main && process.argv[2]) {
    var fn = process.argv[2], PATH = require('path');
    if (!/^\//.test(fn)) {
        fn = PATH.resolve(process.cwd(), fn);
    }
    
    var ret = require(fn);
    if (typeof ret === 'function') { ret(); }
}