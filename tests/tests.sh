#!/bin/sh

set -e

node test 
node test-eval 
node test-promise 
node test-promisify 
node test-logging 
node test-once-flowing 
node test-issue-37.js 
node test-no-source-map-support 
node test-broken-source-map-support 
node test-http-client 
node test-http-info
node test-vm
node test-repl