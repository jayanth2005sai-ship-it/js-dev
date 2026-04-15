import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `
                                onTouchStart={(e) => {
                                  longPressTriggered.current = false;
                                  const timer = setTimeout(() => {
                                    longPressTriggered.current = true;
                                    const newSelected = new Set([file.name]);
                                    setSelectedFiles(newSelected);
                                    setShowInfoPanel(true);
                                    if (navigator.vibrate) navigator.vibrate(50);
                                  }, 500);
                                  (e.currentTarget as any).longPressTimer = timer;
                                }}
                                onTouchEnd={(e) => {
                                  clearTimeout((e.currentTarget as any).longPressTimer);
                                }}
                                onTouchMove={(e) => {
                                  clearTimeout((e.currentTarget as any).longPressTimer);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (longPressTriggered.current) {
                                    longPressTriggered.current = false;
                                    return;
                                  }
`;

content = content.replace('                                onClick={(e) => {\n                                  e.stopPropagation();', replacement);

fs.writeFileSync('src/App.tsx', content);
console.log('Done');
