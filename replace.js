import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add import
content = content.replace("import Fuse, { FuseResultMatch } from 'fuse.js';", "import Fuse, { FuseResultMatch } from 'fuse.js';\nimport { Toaster, toast } from 'sonner';");

// Remove fileError state
content = content.replace('  const [fileError, setFileError] = useState<string | null>(null);\n', '');

// Remove setFileError(null)
content = content.replace(/\s*setFileError\(null\);/g, '');

// Replace setFileError(...) with toast.error(...)
content = content.replace(/setFileError\(/g, 'toast.error(');

// Add success toasts
content = content.replace(/fetchFiles\(currentPath\);\s*\} else \{/g, 'fetchFiles(currentPath);\n        toast.success("Operation successful");\n      } else {');

// Remove fileError rendering block
const errorBlockRegex = /\{\s*toast\.error && \(\s*<div className="bg-red-500\/10 border border-red-500\/20 rounded-lg px-4 py-3 mb-4 flex items-center justify-between text-red-400 text-sm">\s*<span>\{toast\.error\}<\/span>\s*<button onClick=\{[^}]+\} className="hover:text-red-300 transition-colors"><X size=\{16\} \/><\/button>\s*<\/div>\s*\)\}/g;
content = content.replace(errorBlockRegex, '');

// Add Toaster
content = content.replace(/<\/div>\s*\);\s*\}\s*$/g, '  <Toaster theme="dark" position="bottom-right" />\n    </div>\n  );\n}\n');

fs.writeFileSync('src/App.tsx', content);
console.log('Done');
