import { Hover, Position } from "vscode-languageserver";
import { parse } from "../parser/index.js";

function getWordAtPosition(sourceText: string, position: Position): string {
  const lines = sourceText.split('\n');
  const line = lines[position.line];
  if (!line) return "";
  
  // Find word boundaries around position.character
  const charPos = position.character;
  let start = charPos;
  while (start > 0 && /[\w]/.test(line.charAt(start - 1))) {
    start--;
  }
  let end = charPos;
  while (end < line.length && /[\w]/.test(line.charAt(end))) {
    end++;
  }
  return line.slice(start, end);
}

function extractDescription(sourceText: string, searchWord: string, type: string): string {
    const lines = sourceText.split('\n');
    let targetLine = -1;
    // Find the declaration line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.includes(`${type} ${searchWord}`) || 
            line.includes(`${type} ${searchWord}(`) || 
            line.includes(`${type} ${searchWord} `) || 
            line.includes(`${type} ${searchWord}:`) || 
            line.includes(`${type} ${searchWord}[`)) {
            targetLine = i;
            break;
        }
    }

    if (targetLine === -1) return "";

    const description: string[] = [];
    for (let i = targetLine - 1; i >= 0; i--) {
        const line = lines[i]!.trim();
        if (line.startsWith('//')) {
            // Remove the '//' and any leading/trailing whitespace or '=' chars used for dividers
            const text = line.replace(/^\/\/\s*/, '').replace(/^=+\s*$/, '').trim();
            if (text) {
              description.unshift(text);
            }
        } else if (line === '') {
            // Stop at blank lines
            continue;
        } else {
            break;
        }
    }
    return description.join('\n');
}

export function getHover(sourceText: string, position: Position): Hover | null {
  const word = getWordAtPosition(sourceText, position);
  if (!word) return null;

  const ast = parse(sourceText);

  // Check tools
  const tool = ast.tools.find(t => t.name === word);
  if (tool) {
    const desc = extractDescription(sourceText, word, 'tool');
    return {
      contents: {
        kind: 'markdown',
        value: `\`\`\`halo\ntool ${tool.name}: ${tool.provider}(${tool.args.join(", ")})\n\`\`\`\n\n${desc ? desc : '*Tool Definition*'}`
      }
    };
  }

  // Check agents
  const agent = ast.agents.find(m => m.name === word);
  if (agent) {
    const desc = extractDescription(sourceText, word, 'agent');
    return {
      contents: {
        kind: 'markdown',
        value: `\`\`\`halo\nmind ${agent.name} [${agent.modelId}]\n\`\`\`\n\n${desc ? desc : '*Agent Definition*'}`
      }
    };
  }

  // Check pipelines
  const pipeline = ast.pipelines.find(s => s.name === word);
  if (pipeline) {
    const desc = extractDescription(sourceText, word, 'pipeline');
    const params = pipeline.params.map(p => `${p.name}: ${p.type}`).join(', ');
    return {
      contents: {
        kind: 'markdown',
        value: `\`\`\`halo\nstream ${pipeline.name}(${params}) -> ${pipeline.returnType}\n\`\`\`\n\n${desc ? desc : '*Pipeline Definition*'}`
      }
    };
  }

  // Check schemas
  const schema = ast.schemas.find(s => s.name === word);
  if (schema) {
    const desc = extractDescription(sourceText, word, 'schema');
    return {
      contents: {
        kind: 'markdown',
        value: `\`\`\`halo\nstruct ${schema.name}\n\`\`\`\n\n${desc ? desc : '*Data Structure*'}`
      }
    };
  }
  
  // Check policies
  const policy = ast.policies.find(g => g.name === word);
  if (policy) {
    const desc = extractDescription(sourceText, word, 'policy');
    return {
      contents: {
        kind: 'markdown',
        value: `\`\`\`halo\nguardrail ${policy.name}\n\`\`\`\n\n${desc ? desc : '*Policy Rule*'}`
      }
    };
  }

  return null;
}
