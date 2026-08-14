const fs = require('fs');
const path = require('path');

// 1x1 white PNG in base64
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const pngBuffer = Buffer.from(pngBase64, 'base64');

const assetDir = './assets';

// Create assets directory if it doesn't exist
if (!fs.existsSync(assetDir)) {
  fs.mkdirSync(assetDir, { recursive: true });
}

// Write PNG files
const files = ['icon.png', 'splash.png', 'adaptive-icon.png', 'favicon.png'];
files.forEach(filename => {
  const filepath = path.join(assetDir, filename);
  fs.writeFileSync(filepath, pngBuffer);
  console.log(`Created ${filepath}`);
});
