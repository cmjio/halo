import fs from 'fs';

function renameFile(file) {
  let text = fs.readFileSync(file, 'utf-8');
  
  text = text.replace(/MindNotFoundError/g, 'AgentNotFoundError');
  text = text.replace(/StreamNotFoundError/g, 'PipelineNotFoundError');
  text = text.replace(/mindName/g, 'agentName');
  text = text.replace(/shadowMind/g, 'shadowAgent');
  text = text.replace(/GuardrailViolation/g, 'PolicyViolation');
  
  fs.writeFileSync(file, text);
}

['src/errors.ts', 'src/runtime/runtime.ts'].forEach(renameFile);
