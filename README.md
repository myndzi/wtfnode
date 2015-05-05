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

# Note

You'll see that the function name listed under timers is `wrapper` -- this is the wrapper around interval timers as created by setInterval. I can still get a source line, but I can't get the original function name out, unfortunately. Caveats like this may exist in other places, too.

# Usage

You can install as a global module (`npm install -g wtfnode`) and call a node script manually: `wtfnode <yourscript>`

If you do this, `wtfnode` will load itself, then `require()` the script you specified.

Alternately, you can load it as a module, using `require()` at the entry point of your own app: `require('wtfnode')`; if you do this, you only need install it locally.

Once `wtfnode` is loaded, all you need do is send SIGINT (Ctrl+C). The process will exit, and the active handles at the time of exit will be printed out.

# Caution

This module wraps and depends on private Node methods. It is in no way guaranteed to work now or ever. If it doesn't work for you, first make sure it is loaded before any other module: some modules take references to things that get replaced/wrapped, so it is required that `wtfnode` gets first dibs on everything.

It currently does something useful under Node 0.12.2. If it stops doing something useful in the future, please post an issue, preferably with a reproducible test script and detailed version information, and I'll try and make it work properly again.

# Testing

I'm usually all about the tests, really, but this module relies so fully on things that it shouldn't that it's kind of not worth it.
