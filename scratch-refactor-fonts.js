const fs = require('fs');
const files = [
  'app/admin/logs/page.tsx',
  'app/admin/dashboard/page.tsx',
  'app/admin/approvals/page.tsx',
  'app/admin/tools/new/page.tsx',
  'app/admin/tools/page.tsx',
  'app/employee/requests/new/page.tsx',
  'app/employee/redress/page.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf-8');
  
  // Replacements
  content = content.replace(/text-\[9px\]/g, 'text-[10px]');
  content = content.replace(/text-\[10px\]/g, 'text-xs');
  content = content.replace(/text-\[11px\]/g, 'text-sm');
  
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});
