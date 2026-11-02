import fs from 'fs';
import path from 'path';

const examplesDir = path.join(process.cwd(), 'examples');
const files = fs.readdirSync(examplesDir).filter(f => f.endsWith('.halo'));

for (const file of files) {
  const filePath = path.join(examplesDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace schema Name: \n field: Type ... with schema Name { ... }
  // We look for "schema Name:" and then lines that are indented
  let inSchema = false;
  let newLines = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^schema\s+\w+:/)) {
      newLines.push(line.replace(':', ' {'));
      inSchema = true;
    } else if (inSchema) {
      if (line.trim() === '' || line.match(/^[a-zA-Z]/) || line.startsWith('//')) {
        // We reached the end of the schema fields
        newLines.push('}');
        newLines.push(line);
        inSchema = false;
      } else {
        newLines.push(line);
      }
    } else {
      newLines.push(line);
    }
  }
  
  // If we ended the file while still inSchema
  if (inSchema) {
    newLines.push('}');
  }
  
  const newContent = newLines.join('\n');
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    console.log("Fixed schema in " + file);
  }
}
