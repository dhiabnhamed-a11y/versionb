import { readFileSync, writeFileSync } from 'fs';

function castParamsId(filePath: string) {
  let content = readFileSync(filePath, 'utf8');
  content = content.replace(/params\.id(?!\s*as\s*string)/g, 'params.id as string');
  writeFileSync(filePath, content);
  console.log(`Fixed params.id in ${filePath}`);
}

castParamsId('src/app/api/v1/projects/[id]/route.ts');
castParamsId('src/app/api/v1/tasks/[id]/route.ts');
