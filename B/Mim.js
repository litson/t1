#!/usr/bin/env node
const { program } = require('commander');
const version = require('../package').version
program.version(version).usage('<command> [options]')
program.parse(process.argv)
if (!program.args.length) {
    program.help();
} else {
    const { main } = require('../dist/index')
    // TODO，多路径
    main(program.args[0])
}