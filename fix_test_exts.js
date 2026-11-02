import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

function fixLyExtensions(file) {
  if (!file.endsWith('.ts')) return;
  
  let text = fs.readFileSync(file, 'utf-8');
  let original = text;
  
  text = text.replace(/\.ly\b/g, '.halo');

  if (text !== original) {
    fs.writeFileSync(file, text);
    console.log(`Updated extensions in ${file}`);
  }
}

walkDir('test', fixLyExtensions);
