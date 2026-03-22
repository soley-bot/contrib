process.chdir(__dirname);
process.argv.push('dev', '--webpack');
require('./node_modules/next/dist/bin/next');
