# Async_wrap and async_hook limitations wrt HTTP parser instances

## Introduction

This repository documents a current limitation of both the async_wrap and
async_hook implementations in Node.js's core.

Because HTTP parser instances are pooled, and thus reused over time, async_wrap
and async_hook events with the same id can be emitted for two unrelated
asynchronous operations.

For instance, a given HTTP client request can be sent and receive a response,
emitting events with id `X`.

Another HTTP client request can be sent and receive a response in a different
asynchronous context but have the same id used when async_wrap/async_hook events
are emitted.

This is a problem when using e.g continuation local storage modules such as
`cls-hooked`, where one would add some object to an asynchronous context
_before_ sending a HTTP request, and retrieve that object when the request's
response is received.

When the request's response is received, the id of the async_wrap/async_hook
events that are emitted before/after the JS callback for handling that response
is called can be the id of a _previous_ asynchronous event, and thus CLS
implementations would retrieve an object set for a different asychronous
context.

## How to reproduce the problem

### Async_wrap

1. Install the latest node v4.x version.

2. Run `node repro-async-wrap.js`

The program should assert, which indicates that the bug was reproduced.

### Async_hook

1. `git clone https://github.com/trevnorris/node`

2. checkout the `async-wrap-eps-impl` branch and build it

3. Run `repro-async-hooks.js` with the binary resulting from the previous step

The program should assert, which indicates that the bug was reproduced

## More details

This is a known issue documented in various places, but from different
perspectives:

1. https://github.com/RobinQu/async-zone/issues/1
2. https://github.com/nodejs/node/pull/5573

[The PR in nodejs/node that implements initial support for the new async_hook
API/framework](https://github.com/nodejs/node/pull/8531) also mentions that
limitation with the following comment in the original description:

> Reused resources aren't reassigned a new UID

We can verify that this is indeed a problem with pool HTTP parser instance. By
applying [a simple patch that makes node _not_ reuse HTTP parser instances](https://gist.github.com/misterdjules/e06595f63bfd184b8f9fb2d0fed2f766)
to nodejs/node's `v4.x` branch and trevnorris/node's `async-wrap-eps-impl`, both
`repro-async-wrap.js` and `repro-async-hook.js` respectively run successfully.