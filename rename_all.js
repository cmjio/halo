import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

function renameFileContents(file) {
  if (!file.endsWith('.ts')) return;
  if (file.includes('HaloParser.ts') || file.includes('HaloVisitor.ts') || file.includes('HaloLexer.ts')) return;
  
  let text = fs.readFileSync(file, 'utf-8');
  let original = text;
  
  // Plurals
  text = text.replace(/\bminds\b/g, 'agents');
  text = text.replace(/\bstreams\b/g, 'pipelines');
  text = text.replace(/\bmemories\b/g, 'stores');
  text = text.replace(/\bguardrails\b/g, 'policies');
  text = text.replace(/\bstructs\b/g, 'schemas');
  
  // Singulars
  text = text.replace(/\bMind\b/g, 'Agent');
  text = text.replace(/\bmind\b/g, 'agent');
  text = text.replace(/\bStream\b/g, 'Pipeline');
  text = text.replace(/\bstream\b/g, 'pipeline');
  text = text.replace(/\bGuardrail\b/g, 'Policy');
  text = text.replace(/\bguardrail\b/g, 'policy');
  text = text.replace(/\bMemory\b/g, 'Store');
  text = text.replace(/\bmemory\b/g, 'store');
  text = text.replace(/\bStruct\b/g, 'Schema');
  text = text.replace(/\bstruct\b/g, 'schema');
  
  // Error types
  text = text.replace(/AgentNotFoundError/g, 'AgentNotFoundError');
  text = text.replace(/PipelineNotFoundError/g, 'PipelineNotFoundError');
  text = text.replace(/PolicyViolation/g, 'PolicyViolation');
  
  // Custom case fixes
  text = text.replace(/\bagentDecl\b/g, 'agentDecl');
  text = text.replace(/\bpolicyRule\b/g, 'policyRule');
  
  // Filenames in imports
  text = text.replace(/guardrails\.js/g, 'policies.js');
  text = text.replace(/memory\.js/g, 'store.js');

  if (text !== original) {
    fs.writeFileSync(file, text);
    console.log(`Updated ${file}`);
  }
}

walkDir('src', renameFileContents);
walkDir('test', renameFileContents);
renameFileContents('index.ts');
renameFileContents('langly.ts');
