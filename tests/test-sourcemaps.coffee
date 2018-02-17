wtf = require('../index')
require('source-map-support').install()

noop = () ->
    undefined

setTimeout(noop, 1000)

wtf.dump()

foo = ->
  bar = -> throw new Error 'this is a demo'
  bar()
foo()