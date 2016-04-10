#!/usr/bin/env node

'use strict';

var Socket, Server, Timer;

function timerCallback(thing) {
    if (typeof thing._onTimeout === 'function') { return '_onTimeout'; }
    if (typeof thing._onImmediate === 'function') { return '_onImmediate'; }
}

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
        if (list instanceof Timer || (typeof list === 'object' && list.hasOwnProperty('_idleNext'))) {
            if (item && timerCallback(item)) {
                var stack = __stack;
                for (var i = 5; i < stack.length; i++) {
                    if (/\//.test(stack[i].file)) {
                        item[timerCallback(item)].__callSite = stack[i];
                        break;
                    }
                }
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
        if (stack[3] && stack[3].file === 'events.js') {
            listener.__callSite = stack[6]; // inline listener binding on net.connect
        }
        else if (stack[4] && /express\/lib\/application\.js$/.test(stack[4].file)) {
            listener.__callSite = stack[5]; // express 4
        }
        else if (stack[3] && stack[3].file === 'http.js') {
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

function getCallsite(fn) {
    if (!fn.__callSite) {
        console.warn('Unable to determine callsite for function "'+(fn.name.trim() || 'unknown')+'". Did you require `wtfnode` at the top of your entry point?');
        return { file: 'unknown', line: 'unknown' };
    }
    return fn.__callSite;
};

function dump() {
    console.log('[WTF Node?] open handles:');
    
    var sockets = [ ], fds = [ ], servers = [ ], _timers = [ ], other = [ ];
    process._getActiveHandles().forEach(function (h) {
        if (h instanceof Socket) {
          if (h.fd) { fds.push(h); }
          else { sockets.push(h); }
        }
        else if (h instanceof Server) { servers.push(h); }
        else if (h instanceof Timer) { _timers.push(h); }
        else { other.push(h); }
    });
    
    if (fds.length) {
        console.log('- File descriptors: (note: stdio won\'t keep your program running)');
        fds.forEach(function (s) {
            var str = '  - fd '+s.fd;
            if (s.isTTY) { str += ' (tty)'; }
            if (s._isStdio) { str += ' (stdio)'; }
            if (s.destroyed) { str += ' (destroyed)'; }
            console.log(str);
        });
    }

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
                    var callSite = getCallsite(fn);
                    console.log('      - %s: %s @ %s:%d', 'connect', fn.name || 'anonymous', callSite.file, callSite.line);
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
                    var callSite = getCallsite(fn);
                    console.log('      - %s: %s @ %s:%d', 'connection', fn.name || 'anonymous', callSite.file, callSite.line);
                });
            }
        });
    }
    
    var timers = [ ];
    _timers.forEach(function (t) {
        if (t._list) {
            // node v5ish behavior
            var timer = t._list;
            do {
                if (timerCallback(timer) && timers.indexOf(timer) === -1) {
                    timers.push(timer);
                }
                timer = timer._idleNext;
            } while (!timer.constructor || timer !== t._list);
        } else {
            // node 0.12ish behavior
            _timers.forEach(function (t) {
                var timer = t;
                while ((timer = timer._idleNext)) {
                    if (timer === t) {
                        break;
                    }
                    if (timerCallback(timer) && timers.indexOf(timer) === -1) {
                        timers.push(timer);
                    }
                }
                
            });
        }
    });
    
    if (timers.length) {
        console.log('- Timers:');
        
        timers.forEach(function (t) {
            var fn = t._onTimeout,
                callSite = getCallsite(fn);
            console.log('  - (%d ~ %s) %s @ %s:%d', t._idleTimeout, formatTime(t._idleTimeout), fn.name, callSite.file, callSite.line);
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
}

function init() {
    process.on('SIGINT', function () {
        try { dump(); }
        catch (e) { console.error(e); }
        process.exit();
    });
}

module.exports = {
    dump: dump,
    init: init
};

if (module === require.main && process.argv[2]) {
    init();
    
    var fn = process.argv[2], PATH = require('path');
    if (!/^\//.test(fn)) {
        fn = PATH.resolve(process.cwd(), fn);
    }
    
    var ret = require(fn);
    if (typeof ret === 'function') { ret(); }
}