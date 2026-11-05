const assert = require('assert/strict');
const { EventEmitter } = require('events');
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

async function runTests() {
  const original = {
    connect: mongoose.connect,
    listen: express.application.listen,
    config: dotenv.config,
    log: console.log,
    error: console.error,
    port: process.env.PORT,
    exitCode: process.exitCode,
  };
  const order = [];
  const errors = [];
  let disconnects = 0;
  let app;
  let server;
  const database = {
    connection: { host: 'mock' },
    disconnect: async () => { disconnects += 1; },
  };
  const connect = async () => {
    order.push('connect');
    return database;
  };

  try {
    process.env.PORT = '0';
    dotenv.config = () => ({});
    console.log = () => {};
    console.error = (message) => { errors.push(message); };
    mongoose.connect = connect;
    const listener = new EventEmitter();
    express.application.listen = () => {
      order.push('listen');
      process.nextTick(() => listener.emit('listening'));
      return listener;
    };

    // Importing either the app or entry point must not connect or open a port.
    // eslint-disable-next-line global-require -- Install connection and listener mocks before import.
    app = require('../app');
    // eslint-disable-next-line global-require -- Observe startup with controlled dependencies.
    const startServer = require('../server');
    assert.deepStrictEqual(order, []);

    assert.strictEqual(await startServer(), listener);
    assert.deepStrictEqual(order, ['connect', 'listen']);
    assert.strictEqual(disconnects, 0);

    order.length = 0;
    mongoose.connect = async () => { throw new Error('Connection failed'); };
    assert.strictEqual(await startServer(), undefined);
    assert.deepStrictEqual(order, []);
    assert.strictEqual(process.exitCode, 1);
    assert.match(errors.pop(), /Database Error: Connection failed/);

    mongoose.connect = connect;
    app.listen = () => {
      const failedListener = new EventEmitter();
      process.nextTick(() => failedListener.emit('error', new Error('Port in use')));
      return failedListener;
    };
    assert.strictEqual(await startServer(), undefined);
    assert.strictEqual(disconnects, 1);
    assert.match(errors.pop(), /Server Error: Port in use/);

    app.listen = () => { throw new Error('Invalid port'); };
    assert.strictEqual(await startServer(), undefined);
    assert.strictEqual(disconnects, 2);
    assert.match(errors.pop(), /Server Error: Invalid port/);

    database.disconnect = async () => { throw new Error('Disconnect failed'); };
    assert.strictEqual(await startServer(), undefined);
    assert.match(errors.pop(), /Database Error: Disconnect failed/);
    assert.match(errors.pop(), /Server Error: Invalid port/);

    // Also verify a real ephemeral listener can start after the mocked database connects.
    express.application.listen = original.listen;
    app.listen = original.listen;
    server = await startServer();
    assert.ok(server.listening);
    assert.ok(server.address().port > 0);
  } finally {
    if (server) await new Promise((resolve) => { server.close(resolve); });
    mongoose.connect = original.connect;
    express.application.listen = original.listen;
    if (app) app.listen = original.listen;
    dotenv.config = original.config;
    console.log = original.log;
    console.error = original.error;
    process.exitCode = original.exitCode;
    if (original.port === undefined) delete process.env.PORT;
    else process.env.PORT = original.port;
  }
  console.log('Passed 7 startup checks. Database connection mocked.');
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
