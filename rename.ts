import { readdirSync, renameSync, rmSync } from 'fs';
import { join } from 'path';

// Rename examples
const examplesDir = join(import.meta.dir, 'examples');
const files = readdirSync(examplesDir);
for (const file of files) {
  if (file.endsWith('.ly')) {
    renameSync(join(examplesDir, file), join(examplesDir, file.replace('.ly', '.halo')));
  }
}

// Rename grammar
const grammarDir = join(import.meta.dir, 'grammars');
renameSync(join(grammarDir, 'Langly.g4'), join(grammarDir, 'Halo.g4'));

console.log("Renaming complete.");
