const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'dist', 'server.js');

if (!fs.existsSync(serverPath)) {
  console.error('Cannot start server: dist/server.js was not found. Run `npm run build` before `node index.js`.');
  process.exit(1);
}

require(serverPath);
