const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');
const lockHtmlReplacement = fs.readFileSync('lock.txt', 'utf8');

// Replace the old lockScreen div. It ends before <div id="app">
html = html.replace(/<div id="lockScreen"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, lockHtmlReplacement);

fs.writeFileSync('index.html', html, 'utf8');
console.log('Lock UI replaced!');
