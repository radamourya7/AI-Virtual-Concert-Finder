const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'js', 'script.js');
let content = fs.readFileSync(filePath, 'utf8');

// Remove single-line comments
content = content.replace(/\/\/.*$/gm, '');

// Remove multi-line comments
content = content.replace(/\/\*[\s\S]*?\*\//g, '');

// Write the cleaned content back to the file
fs.writeFileSync(filePath, content); 