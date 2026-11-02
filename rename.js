import fs from 'fs';

function renameFile(file) {
  let text = fs.readFileSync(file, 'utf-8');
  
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
  
  // Custom case fixes
  text = text.replace(/\bagentDecl\b/g, 'agentDecl');
  text = text.replace(/\bpolicyRule\b/g, 'policyRule');
  
  // Filenames in imports
  text = text.replace(/guardrails\.js/g, 'policies.js');
  text = text.replace(/memory\.js/g, 'store.js');

  fs.writeFileSync(file, text);
}

['src/runtime/runtime.ts', 'src/runtime/adapter.ts', 'src/runtime/router.ts', 'src/runtime/tools.ts'].forEach(renameFile);
