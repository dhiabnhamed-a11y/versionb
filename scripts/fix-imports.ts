import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';

const files = globSync('src/**/*.{ts,tsx}');
let fixedCount = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  let changed = false;

  const hasQueryRaw = /\btenantQueryRaw\b/.test(content);
  const hasExecuteRaw = /\btenantExecuteRaw\b/.test(content);

  if ((hasQueryRaw || hasExecuteRaw) && !content.includes('@/lib/tenant/tenant-raw-query')) {
    const importsToAdd = [];
    if (hasQueryRaw) importsToAdd.push('tenantQueryRaw');
    if (hasExecuteRaw) importsToAdd.push('tenantExecuteRaw');

    // Add import statement at the top of the file
    const importStatement = `import { ${importsToAdd.join(', ')} } from '@/lib/tenant/tenant-raw-query';\n`;
    content = importStatement + content;
    changed = true;
  }

  if (changed) {
    writeFileSync(file, content);
    fixedCount++;
    console.log(`Fixed imports in: ${file}`);
  }
}

console.log(`\nFixed ${fixedCount} files missing raw query imports.`);
