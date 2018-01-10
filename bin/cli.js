#!/usr/bin/env node

const commandLineArgs = require('command-line-args');
const MockHLSServer = require('../src/mock-hls-server');

const optionDefinitions = [
    { name: 'host', type: String, defaultOption: true, defaultValue: 'localhost' },
    { name: 'port', type: Number, alias: 'p', defaultValue: 8080 },
    { name: 'windowSize', type: Number, defaultValue: 10 },
    { name: 'initialDuration', type: Number, defaultValue: 10 },
    { name: 'event', type: Boolean, defaultValue: false },
    { name: 'logLevel', type: Number, defaultValue: 'info' }
];

const { host, port, windowSize, initialDuration, event, logLevel } = commandLineArgs(optionDefinitions);
new MockHLSServer({ host, port, windowSize: event ? null : windowSize, initialDuration, logLevel });