import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace toast.error("...") with notify("...", "error")
content = content.replace(/toast\.error\((.*?)\)/g, 'notify($1, "error")');
content = content.replace(/toast\.success\((.*?)\)/g, 'notify($1, "success")');

// Add Notification interface
const interfaceCode = `
interface AppNotification {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'info';
  timestamp: Date;
  read: boolean;
}
`;
content = content.replace('// Path helpers for frontend', interfaceCode + '\n// Path helpers for frontend');

// Add state and notify function
const stateCode = `
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notify = (title: string, type: 'success' | 'error' | 'info' = 'info', message?: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [{ id, title, message, type, timestamp: new Date(), read: false }, ...prev]);
    if (type === 'success') toast.success(title, { description: message });
    else if (type === 'error') toast.error(title, { description: message });
    else toast(title, { description: message });
  };
`;
content = content.replace('  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);', '  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);\n' + stateCode);

fs.writeFileSync('src/App.tsx', content);
console.log('Done');
