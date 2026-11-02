import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

function fixDeclarations(file) {
  if (!file.endsWith('.ts')) return;
  if (file.includes('HaloParser.ts') || file.includes('HaloVisitor.ts') || file.includes('HaloLexer.ts')) return;
  
  let text = fs.readFileSync(file, 'utf-8');
  let original = text;
  
  text = text.replace(/StreamDeclaration/g, 'PipelineDeclaration');
  text = text.replace(/GuardrailDeclaration/g, 'PolicyDeclaration');
  text = text.replace(/MemoryDeclaration/g, 'StoreDeclaration');
  text = text.replace(/StructDeclaration/g, 'SchemaDeclaration');
  text = text.replace(/GuardrailViolation/g, 'PolicyViolation');
  text = text.replace(/GuardrailPhase/g, 'PolicyPhase');
  text = text.replace(/GuardrailPlugin/g, 'PolicyPlugin');
  text = text.replace(/MemoryPlugin/g, 'StorePlugin');
  text = text.replace(/MemoryRegistry/g, 'StoreRegistry');
  text = text.replace(/GuardrailRegistry/g, 'PolicyRegistry');
  text = text.replace(/StreamParam/g, 'PipelineParam');
  text = text.replace(/StructField/g, 'SchemaField');

  // Fix up variables in loops:
  text = text.replace(/streamDecl/g, 'pipelineDecl');
  text = text.replace(/guardrailDecl/g, 'policyDecl');
  text = text.replace(/memoryDecl/g, 'storeDecl');
  text = text.replace(/structDecl/g, 'schemaDecl');

  if (text !== original) {
    fs.writeFileSync(file, text);
    console.log(`Updated declarations in ${file}`);
  }
}

walkDir('src', fixDeclarations);
walkDir('test', fixDeclarations);
fixDeclarations('index.ts');
fixDeclarations('langly.ts');
