const fs = require('fs');
const path = require('path');

// Ensure dist directory exists
if (!fs.existsSync('android_dist')) {
  fs.mkdirSync('android_dist');
}
if (!fs.existsSync('android_dist/assets')) {
  fs.mkdirSync('android_dist/assets');
}

// 1. Copy required files
if (fs.existsSync('app.obf.js')) fs.copyFileSync('app.obf.js', 'android_dist/app.obf.js');
if (fs.existsSync('android.js')) fs.copyFileSync('android.js', 'android_dist/android.js');

// 2. Copy assets folder contents if exists
if (fs.existsSync('assets')) {
  fs.readdirSync('assets').forEach(file => {
    fs.copyFileSync(path.join('assets', file), path.join('android_dist/assets', file));
  });
}

// 3. Process index.html for mobile
let html = fs.readFileSync('index.html', 'utf8');

// Strip out torrent UI
html = html.replace(/<button id="tab-torrent".*?<\/button>/g, '');
html = html.replace(/<div id="torrentOptions"[\s\S]*?<\/div>\s*<\/div>/, '</div>');
// Remove torrent progress bar
html = html.replace(/<div id="torrentProgressBar"[\s\S]*?<\/div>\s*<\/div>/, '');

// Replace window.nikia calls with window.nikiaMobile (since preload.js isn't used)
html = html.replace(/window\.nikia/g, 'window.nikiaMobile');

// Add mobile-specific meta tags
html = html.replace(
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no">\n    <meta name="theme-color" content="#0a0a0f">\n    <meta name="mobile-web-app-capable" content="yes">\n    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
);

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Inject android.js and update checker
const injectScript = `
  <script src="android.js"></script>
  <script>
    // Poll to wait until DOM and initAuth is ready
    setTimeout(() => {
      if (window.nikiaMobile && window.nikiaMobile.checkForUpdates) {
        window.nikiaMobile.checkForUpdates('${pkg.version}');
      }
    }, 3000);
  </script>
</body>`;

html = html.replace('</body>', injectScript);

// Write to android_dist
fs.writeFileSync('android_dist/index.html', html, 'utf8');

console.log('Successfully prepared web assets for Android in android_dist/');
