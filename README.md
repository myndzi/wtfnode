# What?

This package came out of frustration with trying to track down the cause of stalled node applications. Node exposes process._getActiveHandles(), which is kind of useful except it's hard to tell what is *actually* going on from just those results. This module breaks it down into something a little simpler, with useful information to help you track down what's really keeping your program open.

# Sample output

	[i] app/24191 on devbox: Server listening on 0.0.0.0:9001 in development mode
	^C[WTF Node?] open handles:
	- Sockets:
	  - 10.21.1.16:37696 -> 10.21.2.213:5432
	    - Listeners:
	      - connect: anonymous @ /home/me/app/node_modules/pg/lib/connection.js:49
	  - 10.21.1.16:37697 -> 10.21.2.213:5432
	    - Listeners:
	      - connect: anonymous @ /home/me/app/node_modules/pg/lib/connection.js:49
	  - 10.21.1.16:37698 -> 10.21.2.213:5432
	    - Listeners:
	      - connect: anonymous @ /home/me/app/node_modules/pg/lib/connection.js:49
	  - 10.21.1.16:37699 -> 10.21.2.213:5432
	    - Listeners:
	      - connect: anonymous @ /home/me/app/node_modules/pg/lib/connection.js:49
	  - 10.21.1.16:37700 -> 10.21.2.213:5432
	    - Listeners:
	      - connect: anonymous @ /home/me/app/node_modules/pg/lib/connection.js:49
	- Servers:
	  - 0.0.0.0:9001
	    - Listeners:
	      - connection: connectionListener @ /home/me/app/app-framework/lib/listener.js:13
	- Timers:
	  - (10000 ~ 10 s) wrapper @ /home/me/app/node_modules/knex/node_modules/pool2/lib/pool.js:80
	  - (300000 ~ 5 min) wrapper @ /home/me/app/services/foo.service.js:61

# Notes

## Timers named "wrapper"
You'll see that the function name listed under timers is `wrapper` -- this is the wrapper around interval timers as created by setInterval. I can still get a source line, but I can't get the original function name out, unfortunately. Caveats like this may exist in other places, too.

## "IPC channel to parent"
When using child_process.fork, or child_process.spawn with default stdio configuration (or possibly when your program is run by something else, such as PM2), an inter-process communication (IPC) channel is opened to send messages between the parent and child. Since this is not based on any code the current program has executed, I can't get much more information than that. It means that the parent end of the connection is still open, so you'll want to investigate whatever spawned the process you're seeing this from.

When using wtfnode from a child process, on version 0.12 there is some strange behavior where a child process handle briefly exists and you will get a warning such as "unable to determine callsite" -- this is peaceful to ignore, and can be avoided by delaying the call to `wtf.dump()` slightly.

# Command line usage

You can install as a global module (`npm install -g wtfnode`) and call a node script manually: `wtfnode <yourscript> <yourargs> ...`

If you do this, `wtfnode` will load itself, then forward control to the script you specified as if you had run `node <yourscript> ...`. When you are ready, send SIGINT (Ctrl+C). The process will exit, and the active handles at the time of exit will be printed out.

Version 0.4.0: When a module has bound SIGINT, Node will no longer be able to exit when in an infinite loop. `wtfnode` now instead launches the target by way of a watchdog proxy; you may now Ctrl+C twice to force termination. No information will be available, since no other code can be run while an infinite loop is executing, but this should at least make life a little easier.

# Module usage

Install as a local module (`npm install wtfnode`).

Require the module: `var wtf = require('wtfnode');`

When you are ready, call `wtf.dump()` to dump open handles. Note that if you call this from a timer, the timer itself may show up!

**Important**: Require at the entry point of your application. You must do this before loading / referencing even native node modules, or certain hooks may not be effective.

## Configuring logging
`wtfnode` uses three logging levels, which default to `console.log`, `console.warn`, and `console.error`. The output is sent to `console.log`; warnings about potential problems when calculating the output are sent to `console.warn`; `console.error` is currently only used to print CLI usage info.

You can set these functions to an arbitrary log function of your own. It will be passed data in the same way that console.log receives it, so if you want a plain string you should call `util.format.apply(util, args)` on the data you receive.

Usage:
```js
var wtf = require('wtfnode');

wtf.setLogger('info', function (...) { ... });
wtf.setLogger('warn', function (...) { ... });
wtf.setLogger('error', function (...) { ... });

wtf.resetLoggers(); // if you want to put them back for some reason
```

# Caution

This module wraps and depends on private Node methods. It is in no way guaranteed to work now or ever. If it doesn't work for you, first make sure it is loaded before any other module: some modules take references to things that get replaced/wrapped, so it is required that `wtfnode` gets first dibs on everything.

It currently does something useful under Node 0.10 through 8.6. If it stops doing something useful in the future, please post an issue, preferably with a reproducible test script and detailed version information, and I'll try and make it work properly again.

# Testing

I'm usually all about the tests, really, but this module relies so fully on things that it shouldn't that it's kind of not worth it.
