// Minimal static server for the Euchre app. Binds 0.0.0.0 so a phone on the
// same network can reach it at http://<PC-LAN-IP>:5050
const express = require('express');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.EUCHRE_PORT || 5050;

// no-cache so phones always pull the latest CSS/JS during development
app.use(express.static(__dirname, {
  etag: false,
  lastModified: false,
  setHeaders: (res) => res.set('Cache-Control', 'no-store, must-revalidate'),
}));

function lanIPs() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name]) {
      if (i.family === 'IPv4' && !i.internal) out.push(i.address);
    }
  }
  return out;
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ♠ ♥ ♦ ♣  Euchre running\n`);
  console.log(`  Local:   http://localhost:${PORT}`);
  for (const ip of lanIPs()) console.log(`  Phone:   http://${ip}:${PORT}`);
  console.log('');
});
