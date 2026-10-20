const fs = require('node:fs');
const path = require('node:path');
// Test input only: never bundle or distribute a machine's installed font.
module.exports = [process.env.ROBLOX_TEST_FONT,
  path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'consola.ttf'),
  '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf']
  .find(file => file && fs.existsSync(file));
