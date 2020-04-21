const fs = require('fs');
const dep1 = require('dep-1')
const dep2 = require('dep-2')

fs.mkdirSync('./out');
fs.writeFileSync('./out/index.html', `I am app 1 (data from deps: ${dep1}, ${dep2})`)
