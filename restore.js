const fs = require('fs');
const path = require('path');

const backupDir = path.join(__dirname, 'backup_src');

if (fs.existsSync(backupDir)) {
  const files = fs.readdirSync(backupDir);
  
  files.forEach(file => {
    fs.copyFileSync(path.join(backupDir, file), path.join(__dirname, file));
  });
  
  // Cleanup obfuscated files that aren't in backup
  if (fs.existsSync(path.join(__dirname, 'app.obf.js'))) {
    fs.unlinkSync(path.join(__dirname, 'app.obf.js'));
  }
  
  console.log('Restored original source files.');
} else {
  console.log('No backup directory found.');
}
