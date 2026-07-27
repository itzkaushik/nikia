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

// 4. Sync version to Android build.gradle
try {
  const gradlePath = path.join('android', 'app', 'build.gradle');
  if (fs.existsSync(gradlePath)) {
    let gradle = fs.readFileSync(gradlePath, 'utf8');
    
    // Extract version parts (e.g., "1.0.22" -> 22 or 10022)
    const versionParts = pkg.version.split('.');
    let vCode = 1;
    if (versionParts.length === 3) {
      // Create a stable versionCode like 10022 for 1.0.22
      vCode = parseInt(versionParts[0]) * 10000 + parseInt(versionParts[1]) * 100 + parseInt(versionParts[2]);
    }
    
    // Replace versionCode and versionName
    gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${vCode}`);
    gradle = gradle.replace(/versionName\s+".*?"/, `versionName "${pkg.version}"`);
    
    fs.writeFileSync(gradlePath, gradle, 'utf8');
    console.log(`Synced Android version to ${pkg.version} (code ${vCode}) in build.gradle`);
  }
} catch (e) {
  console.error('Failed to sync Android version to build.gradle:', e);
}
