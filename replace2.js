import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace toast.error("...") with notify("...", "error")
// We have to be careful with the arguments.
// Actually, it's easier to just define notify like this:
// const notify = {
//   error: (msg: string) => { ... },
//   success: (msg: string) => { ... },
//   info: (msg: string) => { ... }
// };
// Then we don't even need to replace toast.error with notify! We can just replace `toast.` with `notify.`

content = content.replace(/toast\.error\(/g, 'notify.error(');
content = content.replace(/toast\.success\(/g, 'notify.success(');

fs.writeFileSync('src/App.tsx', content);
console.log('Done');
