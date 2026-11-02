import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

function replaceInHaloFiles(file) {
  if (!file.endsWith('.halo') && !file.endsWith('.ts')) return;
  if (file.includes('HaloParser.ts') || file.includes('HaloVisitor.ts') || file.includes('HaloLexer.ts')) return;
  
  let text = fs.readFileSync(file, 'utf-8');
  let original = text;
  
  // Syntax keywords
  text = text.replace(/\bmind /g, 'agent ');
  text = text.replace(/\bstream /g, 'pipeline ');
  text = text.replace(/\bstruct /g, 'schema ');
  text = text.replace(/\bmemory /g, 'store ');
  text = text.replace(/\bguardrail /g, 'policy ');

  // For extensions and CLI specific templates:
  text = text.replace(/\.ly\b/g, '.halo');
  text = text.replace(/langly\.json/g, 'halo.json');

  if (text !== original) {
    fs.writeFileSync(file, text);
    console.log(`Updated keywords in ${file}`);
  }
}

walkDir('examples', replaceInHaloFiles);
replaceInHaloFiles('src/cli.ts');
