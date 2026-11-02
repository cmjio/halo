const fs = require('fs');
const path = require('path');

const files = [
  'docs/dictionary.md',
  'docs/grammar_review.md',
  'docs/spec.md'
];

for (const file of files) {
  const p = path.join(__dirname, file);
  if (!fs.existsSync(p)) continue;
  let content = fs.readFileSync(p, 'utf8');
  
  // Replace terms
  content = content.replace(/Langly/g, 'Halo');
  content = content.replace(/langly/g, 'halo');
  content = content.replace(/\bmind\b/g, 'agent');
  content = content.replace(/\bMind\b/g, 'Agent');
  content = content.replace(/\bminds\b/g, 'agents');
  content = content.replace(/\bstream\b/g, 'pipeline');
  content = content.replace(/\bStream\b/g, 'Pipeline');
  content = content.replace(/\bstreams\b/g, 'pipelines');
  content = content.replace(/\bguardrail\b/g, 'policy');
  content = content.replace(/\bGuardrail\b/g, 'Policy');
  content = content.replace(/\bguardrails\b/g, 'policies');
  content = content.replace(/\.ly/g, '.halo');
  
  fs.writeFileSync(p, content);
  console.log('Updated ' + file);
}
