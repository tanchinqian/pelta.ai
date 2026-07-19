const fs = require('fs');
const files = ['./app/admin/tools/page.tsx', './app/admin/approvals/page.tsx'];
const map = {
  'text-xs': 'text-sm',
  'text-sm': 'text-base',
  'text-base': 'text-lg',
  'text-lg': 'text-xl',
  'text-xl': 'text-2xl',
  'text-2xl': 'text-3xl'
};

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/\b(text-xs|text-sm|text-base|text-lg|text-xl|text-2xl)\b/g, (match) => map[match] || match);
  fs.writeFileSync(file, newContent);
}
