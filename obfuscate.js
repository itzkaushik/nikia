const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const cheerio = require('cheerio');

const filesToObfuscate = ['main.js', 'preload.js'];
const backupDir = path.join(__dirname, 'backup_src');

// 1. Backup original files
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
}

// Backup JS files
filesToObfuscate.forEach(file => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(path.join(__dirname, file), path.join(backupDir, file));
  }
});

// Backup HTML
if (fs.existsSync('index.html')) {
    fs.copyFileSync(path.join(__dirname, 'index.html'), path.join(backupDir, 'index.html'));
}

// 2. Obfuscate JS files in-place
const options = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    disableConsoleOutput: true
};

filesToObfuscate.forEach(file => {
  if (fs.existsSync(file)) {
      const src = fs.readFileSync(file, 'utf8');
      const obf = JavaScriptObfuscator.obfuscate(src, options);
      fs.writeFileSync(file, obf.getObfuscatedCode());
      console.log(`Obfuscated ${file}`);
  }
});

// 3. Obfuscate inline JS in index.html
if (fs.existsSync('index.html')) {
    const htmlContent = fs.readFileSync('index.html', 'utf8');
    const $ = cheerio.load(htmlContent);
    let scriptContent = '';

    // Extract all inline scripts
    $('script').each((i, el) => {
      if (!$(el).attr('src')) {
        scriptContent += $(el).html() + '\n';
        $(el).remove();
      }
    });

    // Obfuscate the combined script
    if (scriptContent.trim().length > 0) {
      const obfScript = JavaScriptObfuscator.obfuscate(scriptContent, options);
      
      // Inject the obfuscated script back as a separate file
      fs.writeFileSync('app.obf.js', obfScript.getObfuscatedCode());
      $('body').append('<script src="app.obf.js"></script>');
      
      fs.writeFileSync('index.html', $.html());
      console.log('Obfuscated inline scripts in index.html into app.obf.js');
    }
}
