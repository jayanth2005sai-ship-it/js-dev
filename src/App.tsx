/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutGrid, 
  Settings, 
  Cpu, 
  HardDrive, 
  Activity, 
  Clock, 
  Search, 
  Bell, 
  Power,
  FolderOpen,
  Terminal as TerminalIcon,
  Globe,
  Shield,
  Cloud,
  Database,
  Music,
  Video,
  Image as ImageIcon,
  X,
  ChevronRight,
  File,
  ChevronLeft,
  Server,
  Home,
  Upload,
  FolderPlus,
  List,
  Grid
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Fuse, { FuseResultMatch } from 'fuse.js';

// Types
interface AppIcon {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  action?: () => void;
}

interface AppIconWithMatches extends AppIcon {
  matches?: readonly FuseResultMatch[];
}

interface SystemStat {
  label: string;
  value: number;
  icon: React.ReactNode;
  unit: string;
}

interface FileItem {
  name: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  created: string;
  accessed: string;
  permissions: string;
}

// Path helpers for frontend
const path = {
  dirname: (p: string) => p.split('/').slice(0, -1).join('/') || '/',
  join: (...parts: string[]) => parts.join('/').replace(/\/+/g, '/'),
  extname: (p: string) => {
    const match = p.match(/\.[^.]+$/);
    return match ? match[0] : '';
  }
};

// Helper component for highlighting fuzzy search matches
const HighlightedText = ({ text, matches }: { text: string, matches?: readonly FuseResultMatch[] }) => {
  if (!matches || matches.length === 0) return <>{text}</>;
  
  const match = matches.find(m => m.key === 'name');
  if (!match || !match.indices || match.indices.length === 0) return <>{text}</>;

  let lastIndex = 0;
  const elements: React.ReactNode[] = [];

  match.indices.forEach(([start, end], i) => {
    if (start > lastIndex) {
      elements.push(<span key={`text-${i}`}>{text.slice(lastIndex, start)}</span>);
    }
    elements.push(
      <span key={`match-${i}`} className="text-blue-400 bg-blue-400/20 rounded px-[2px] font-bold">
        {text.slice(start, end + 1)}
      </span>
    );
    lastIndex = end + 1;
  });

  if (lastIndex < text.length) {
    elements.push(<span key={`text-end`}>{text.slice(lastIndex)}</span>);
  }

  return <>{elements}</>;
};

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Terminal from './components/Terminal';

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [systemStats, setSystemStats] = useState({
    cpu: { usage: 0, cores: 0, brand: '', speed: 0 },
    ram: { usagePercent: 0, usedGB: '0', totalGB: '0' },
    disk: { usagePercent: 0, usedGB: '0', totalGB: '0' },
    os: { distro: '', release: '', uptime: 0, hostname: 'CasaDash' }
  });

  // Modal States
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingPermissionsFile, setEditingPermissionsFile] = useState<FileItem | null>(null);
  const [newPermissions, setNewPermissions] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [imageRotation, setImageRotation] = useState(0);

  // Auth States
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Wallpaper State
  const DEFAULT_WALLPAPER = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop';
  const [wallpaperUrl, setWallpaperUrl] = useState(() => {
    return localStorage.getItem('casadash_wallpaper') || DEFAULT_WALLPAPER;
  });
  const [wallpaperError, setWallpaperError] = useState('');
  const [wallpaperInputUrl, setWallpaperInputUrl] = useState('');

  // Helper to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/check-auth', { 
          credentials: 'include',
          headers: { ...getAuthHeaders() }
        });
        if (response.ok) {
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats', { 
          credentials: 'include',
          headers: { ...getAuthHeaders() }
        });
        if (response.ok) {
          const data = await response.json();
          setSystemStats(data);
        } else {
          const errData = await response.json();
          console.error("Stats API error:", errData);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
    };

    fetchStats();
    const statsInterval = setInterval(fetchStats, 5000);

    return () => {
      clearInterval(timer);
      clearInterval(statsInterval);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    let objectUrl: string | null = null;

    const fetchPreview = async () => {
      setImageRotation(0);
      if (!previewFile) {
        setPreviewContent(null);
        return;
      }
      
      const ext = path.extname(previewFile.name).toLowerCase();
      const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext);
      const isText = ['.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.csv', '.log', '.env'].includes(ext);
      
      if (isText || isImage) {
        setIsPreviewLoading(true);
        try {
          const filePath = path.join(currentPath, previewFile.name);
          const response = await fetch(`/api/files/raw?path=${encodeURIComponent(filePath)}`, {
            headers: { ...getAuthHeaders() },
            credentials: 'include'
          });
          if (response.ok) {
            if (isText) {
              const text = await response.text();
              setPreviewContent(text);
            } else if (isImage) {
              const blob = await response.blob();
              objectUrl = window.URL.createObjectURL(blob);
              setPreviewContent(objectUrl);
            }
          } else {
            setPreviewContent("Failed to load file content.");
          }
        } catch (error) {
          setPreviewContent("Error loading file content.");
        } finally {
          setIsPreviewLoading(false);
        }
      } else {
        setPreviewContent(null);
      }
    };
    
    fetchPreview();

    return () => {
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [previewFile, currentPath]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
        }
        setIsAuthenticated(true);
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch (error) {
      setLoginError('Network error');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { 
        method: 'POST', 
        credentials: 'include',
        headers: { ...getAuthHeaders() }
      });
      localStorage.removeItem('auth_token');
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const fetchFiles = async (path: string = '') => {
    setFileError(null);
    try {
      const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`, { 
        credentials: 'include',
        headers: { ...getAuthHeaders() }
      });
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files);
        setCurrentPath(data.path);
        setSelectedFiles(new Set()); // Clear selection on navigate
        setPreviewFile(null); // Clear preview on navigate
      } else {
        const errorData = await response.json().catch(() => ({}));
        setFileError(errorData.error || "Failed to fetch files. Permission denied or path does not exist.");
      }
    } catch (error: any) {
      console.error("Failed to fetch files:", error);
      setFileError(error.message || "Network error while fetching files.");
    }
  };

  const handleDownloadSelected = async () => {
    if (selectedFiles.size === 0) return;
    setFileError(null);
    
    const filePaths = Array.from(selectedFiles).map((name: string) => path.join(currentPath, name));
    
    try {
      const response = await fetch('/api/files/download', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({ files: filePaths })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'download.zip';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Reset selection
        setSelectedFiles(new Set());
        setIsSelectMode(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setFileError(errorData.error || "Failed to download selected files.");
      }
    } catch (error: any) {
      console.error("Error downloading files:", error);
      setFileError(error.message || "Network error while downloading files.");
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return;
    
    setFileError(null);
    setShowDeleteConfirm(false);
    
    const filePaths = Array.from(selectedFiles).map((name: string) => path.join(currentPath, name));
    
    try {
      const response = await fetch('/api/files', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({ files: filePaths })
      });
      
      if (response.ok) {
        // Reset selection and refresh files
        setSelectedFiles(new Set());
        setIsSelectMode(false);
        fetchFiles(currentPath);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setFileError(errorData.error || "Failed to delete selected files.");
      }
    } catch (error: any) {
      console.error("Error deleting files:", error);
      setFileError(error.message || "Network error while deleting files.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setFileError(null);
    
    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
      formData.append('files', e.target.files[i]);
    }

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'x-target-dir': currentPath
        },
        credentials: 'include',
        body: formData
      });
      
      if (response.ok) {
        fetchFiles(currentPath); // Refresh directory
      } else {
        const errorData = await response.json().catch(() => ({}));
        setFileError(errorData.error || "Failed to upload files.");
      }
    } catch (error: any) {
      console.error("Error uploading files:", error);
      setFileError(error.message || "Network error while uploading files.");
    }
    
    // Clear input
    e.target.value = '';
  };

  const handleCreateDirectory = async () => {
    if (!newFolderName.trim()) return;
    setFileError(null);
    try {
      const response = await fetch('/api/files/mkdir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({
          targetPath: currentPath,
          name: newFolderName.trim()
        })
      });
      if (response.ok) {
        setIsCreatingFolder(false);
        setNewFolderName('');
        fetchFiles(currentPath);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setFileError(errorData.error || "Failed to create directory.");
      }
    } catch (error: any) {
      console.error("Error creating directory:", error);
      setFileError(error.message || "Network error while creating directory.");
    }
  };

  const handlePermissionsChange = async () => {
    if (!editingPermissionsFile) return;
    setFileError(null);
    try {
      const response = await fetch('/api/files/permissions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({ 
          filePath: path.join(currentPath, editingPermissionsFile.name), 
          mode: newPermissions 
        })
      });
      if (response.ok) {
        setEditingPermissionsFile(null);
        fetchFiles(currentPath);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setFileError(errorData.error || "Failed to change permissions.");
      }
    } catch (error: any) {
      console.error("Error changing permissions:", error);
      setFileError(error.message || "Network error while changing permissions.");
    }
  };

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Max dimensions for wallpaper
          const MAX_WIDTH = 1280;
          const MAX_HEIGHT = 720;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Canvas to Blob failed'));
              }
            },
            'image/jpeg',
            0.6 // 60% quality to ensure < 1MB
          );
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setWallpaperError('Processing image...');

    try {
      const compressedBlob = await compressImage(file);
      const formData = new FormData();
      formData.append('wallpaper', compressedBlob, file.name.replace(/\.[^/.]+$/, "") + ".jpg");

      setWallpaperError('Uploading...');
      const response = await fetch('/api/upload-wallpaper', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: { ...getAuthHeaders() }
      });
      
      if (response.ok) {
        const data = await response.json();
        setWallpaperUrl(data.url);
        localStorage.setItem('casadash_wallpaper', data.url);
        setWallpaperError('Wallpaper updated successfully!');
        setTimeout(() => setWallpaperError(''), 3000);
      } else {
        // Fallback: If server upload fails (e.g. Nginx 413 limit), store base64 directly
        const reader = new FileReader();
        reader.readAsDataURL(compressedBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          try {
            setWallpaperUrl(base64data);
            localStorage.setItem('casadash_wallpaper', base64data);
            setWallpaperError('Wallpaper saved locally!');
            setTimeout(() => setWallpaperError(''), 3000);
          } catch (e) {
            setWallpaperError('Upload failed and image is too large to save locally.');
          }
        };
      }
    } catch (error) {
      console.error('Failed to upload wallpaper', error);
      setWallpaperError('Error processing or uploading image.');
    }
  };

  const handleSetWallpaperUrl = () => {
    if (!wallpaperInputUrl.trim()) return;
    setWallpaperUrl(wallpaperInputUrl);
    localStorage.setItem('casadash_wallpaper', wallpaperInputUrl);
    setWallpaperInputUrl('');
    setWallpaperError('Wallpaper updated from URL!');
    setTimeout(() => setWallpaperError(''), 3000);
  };

  const handleResetWallpaper = () => {
    setWallpaperUrl(DEFAULT_WALLPAPER);
    localStorage.removeItem('casadash_wallpaper');
    setWallpaperError('Wallpaper reset to default!');
    setTimeout(() => setWallpaperError(''), 3000);
  };

  const apps: AppIcon[] = [
    { id: 'files', name: 'Files', icon: <FolderOpen size={32} />, color: 'bg-blue-500', action: () => { setActiveModal('files'); fetchFiles(); } },
    { id: 'terminal', name: 'Terminal', icon: <TerminalIcon size={32} />, color: 'bg-zinc-800', action: () => setActiveModal('terminal') },
    { id: 'browser', name: 'Browser', icon: <Globe size={32} />, color: 'bg-orange-500' },
    { id: 'security', name: 'Security', icon: <Shield size={32} />, color: 'bg-emerald-500' },
    { id: 'cloud', name: 'Cloud', icon: <Cloud size={32} />, color: 'bg-sky-400' },
    { id: 'database', name: 'Database', icon: <Database size={32} />, color: 'bg-indigo-600' },
    { id: 'music', name: 'Music', icon: <Music size={32} />, color: 'bg-pink-500' },
    { id: 'video', name: 'Video', icon: <Video size={32} />, color: 'bg-red-500' },
    { id: 'photos', name: 'Photos', icon: <ImageIcon size={32} />, color: 'bg-amber-500' },
    { id: 'settings', name: 'Settings', icon: <Settings size={32} />, color: 'bg-slate-500', action: () => setActiveModal('settings') },
  ];

  const stats: SystemStat[] = [
    { label: 'CPU', value: systemStats.cpu, icon: <Cpu size={18} />, unit: '%' },
    { label: 'RAM', value: systemStats.ram, icon: <Activity size={18} />, unit: '%' },
    { label: 'Disk', value: systemStats.disk, icon: <HardDrive size={18} />, unit: '%' },
  ];

  const fuse = new Fuse(apps, {
    keys: ['name'],
    includeMatches: true,
    threshold: 0.4,
  });

  const filteredApps: AppIconWithMatches[] = searchQuery
    ? fuse.search(searchQuery).map(result => ({
        ...result.item,
        matches: result.matches
      }))
    : apps;

  if (isCheckingAuth) {
    return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-blue-500/30 overflow-hidden relative flex items-center justify-center">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 scale-105 blur-sm"
          style={{ backgroundImage: `url(${wallpaperUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md mx-4 p-6 md:p-8 rounded-3xl bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
              <LayoutGrid size={32} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome to CasaDash</h1>
            <p className="text-sm text-white/60 mt-2 text-center">Enter your server's OS credentials to continue.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input 
                type="text" 
                placeholder="Username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                required
              />
            </div>
            <div>
              <input 
                type="password" 
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                required
              />
            </div>
            
            {loginError && (
              <p className="text-red-400 text-sm text-center">{loginError}</p>
            )}

            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors shadow-lg shadow-blue-500/20 mt-4"
            >
              Log In
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-blue-500/30 overflow-hidden relative">
      {/* Background Wallpaper with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 scale-105 blur-sm"
        style={{ backgroundImage: `url(${wallpaperUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />

      {/* Top Navigation Bar */}
      <nav className="relative z-10 flex items-center justify-between px-4 md:px-8 py-4 backdrop-blur-md bg-black/10 border-b border-white/5">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Home size={18} className="text-white" />
            </div>
            <span className="hidden sm:inline">CasaDash</span>
          </div>
          
          <div className="hidden md:flex items-center gap-4 text-sm font-medium text-white/60">
            <span className="hover:text-white transition-colors cursor-pointer">Dashboard</span>
            <span className="hover:text-white transition-colors cursor-pointer">App Store</span>
            <span className="hover:text-white transition-colors cursor-pointer">Files</span>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <div className="flex items-center gap-2 md:gap-4 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <Clock size={16} className="text-blue-400" />
            <span className="text-sm font-mono tracking-wider">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <Bell size={20} />
            </button>
            <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors text-red-400">
              <Power size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="relative z-10 container mx-auto px-4 md:px-8 pt-6 md:pt-12 pb-24 h-[calc(100vh-76px)] overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
          
          {/* Left Sidebar: System Info & Search */}
          <div className="lg:col-span-3 space-y-8">
            {/* Search Bar */}
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-blue-400 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search apps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all backdrop-blur-xl"
              />
            </div>

            {/* System Status Widgets */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 px-1">System Status</h2>
              <div className="grid grid-cols-1 gap-4">
                {/* CPU */}
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/5 rounded-lg text-blue-400">
                        <Cpu size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-white/40 font-medium">CPU ({systemStats.cpu.cores} Cores)</p>
                        <p className="text-lg font-bold">{systemStats.cpu.usage}%</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/30 truncate max-w-[100px]" title={systemStats.cpu.brand}>{systemStats.cpu.brand}</p>
                      <p className="text-[10px] text-white/30">{systemStats.cpu.speed} GHz</p>
                    </div>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${systemStats.cpu.usage}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-blue-500"
                    />
                  </div>
                </motion.div>

                {/* RAM */}
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/5 rounded-lg text-emerald-400">
                        <Activity size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-white/40 font-medium">RAM</p>
                        <p className="text-lg font-bold">{systemStats.ram.usagePercent}%</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/30">{systemStats.ram.usedGB} GB Used</p>
                      <p className="text-[10px] text-white/30">{systemStats.ram.totalGB} GB Total</p>
                    </div>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${systemStats.ram.usagePercent}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-emerald-500"
                    />
                  </div>
                </motion.div>
                
                {/* OS Info */}
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/5 rounded-lg text-purple-400">
                        <Server size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-white/40 font-medium">OS</p>
                        <p className="text-sm font-bold truncate max-w-[120px]" title={`${systemStats.os.distro} ${systemStats.os.release}`}>
                          {systemStats.os.distro}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/30">Uptime</p>
                      <p className="text-[10px] text-white/30 font-mono">
                        {Math.floor(systemStats.os.uptime / 3600)}h {Math.floor((systemStats.os.uptime % 3600) / 60)}m
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Storage Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 backdrop-blur-xl">
              <div className="flex justify-between items-start mb-6">
                <h3 className="font-bold">Main Storage</h3>
                <HardDrive size={20} className="text-blue-400" />
              </div>
              <div className="relative h-32 flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-white/5"
                  />
                  <motion.circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={251.2}
                    initial={{ strokeDashoffset: 251.2 }}
                    animate={{ strokeDashoffset: 251.2 - (251.2 * systemStats.disk.usagePercent) / 100 }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                    className="text-blue-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold">{systemStats.disk.usagePercent}%</span>
                  <span className="text-[10px] text-white/40 uppercase">Used</span>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-white/60">
                  {Math.max(0, parseFloat(systemStats.disk.totalGB) - parseFloat(systemStats.disk.usedGB)).toFixed(2)} GB free of {systemStats.disk.totalGB} GB
                </p>
              </div>
            </div>
          </div>

          {/* Right Content: App Grid */}
          <div className="lg:col-span-9">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold tracking-tight">Installed Apps</h2>
              <button className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                Manage Apps <Settings size={14} />
              </button>
            </div>

            <motion.div 
              layout
              className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6"
            >
              <AnimatePresence mode="popLayout">
                {filteredApps.map((app, index) => (
                  <motion.div
                    key={app.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -8 }}
                    onClick={app.action}
                    className="group flex flex-col items-center gap-2 md:gap-4 cursor-pointer"
                  >
                    <div className={`w-16 h-16 md:w-20 md:h-20 ${app.color} rounded-2xl md:rounded-3xl flex items-center justify-center shadow-2xl shadow-black/40 group-hover:shadow-blue-500/20 transition-all duration-300 relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      {app.icon}
                    </div>
                    <span className="text-xs md:text-sm font-medium text-center text-white/80 group-hover:text-white transition-colors">
                      <HighlightedText text={app.name} matches={app.matches} />
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {/* Add App Placeholder */}
              <motion.div
                whileHover={{ y: -8 }}
                className="group flex flex-col items-center gap-2 md:gap-4 cursor-pointer"
              >
                <div className="w-16 h-16 md:w-20 md:h-20 bg-white/5 border-2 border-dashed border-white/10 rounded-2xl md:rounded-3xl flex items-center justify-center group-hover:border-blue-500/50 group-hover:bg-blue-500/5 transition-all">
                  <LayoutGrid size={24} className="text-white/20 group-hover:text-blue-400 transition-colors md:w-8 md:h-8" />
                </div>
                <span className="text-xs md:text-sm font-medium text-center text-white/40 group-hover:text-blue-400 transition-colors">
                  Install More
                </span>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {activeModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-12 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-5xl h-full max-h-[100dvh] md:max-h-[800px] bg-[#1a1a1a] rounded-none md:rounded-3xl border-0 md:border border-white/10 shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-3">
                  {activeModal === 'files' ? <FolderOpen className="text-blue-400" /> : 
                   activeModal === 'settings' ? <Settings className="text-slate-400" /> :
                   <TerminalIcon className="text-emerald-400" />}
                  <span className="font-bold capitalize">{activeModal}</span>
                </div>
                <button 
                  onClick={() => setActiveModal(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-hidden">
                {activeModal === 'settings' ? (
                  <div className="h-full p-6 text-white overflow-y-auto">
                    <h3 className="text-xl font-bold mb-6">Dashboard Settings</h3>
                    <div className="space-y-8 max-w-md">
                      <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                        <h4 className="text-sm font-bold text-white/80 mb-4 flex items-center gap-2">
                          <ImageIcon size={16} /> Custom Wallpaper
                        </h4>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs text-white/60 mb-2 uppercase tracking-wider">
                              Upload Image
                            </label>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleWallpaperUpload}
                              className="block w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 transition-all cursor-pointer"
                            />
                          </div>

                          <div className="relative flex items-center gap-2">
                            <div className="flex-grow border-t border-white/10"></div>
                            <span className="text-xs text-white/40 uppercase">OR</span>
                            <div className="flex-grow border-t border-white/10"></div>
                          </div>

                          <div>
                            <label className="block text-xs text-white/60 mb-2 uppercase tracking-wider">
                              Image URL
                            </label>
                            <div className="flex gap-2">
                              <input 
                                type="text" 
                                placeholder="https://..."
                                value={wallpaperInputUrl}
                                onChange={(e) => setWallpaperInputUrl(e.target.value)}
                                className="flex-1 bg-black/20 border border-white/10 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              />
                              <button 
                                onClick={handleSetWallpaperUrl}
                                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                              >
                                Set
                              </button>
                            </div>
                          </div>

                          {wallpaperError && (
                            <p className={`text-sm ${wallpaperError.includes('success') || wallpaperError.includes('updated') || wallpaperError.includes('reset') ? 'text-emerald-400' : 'text-red-400'}`}>
                              {wallpaperError}
                            </p>
                          )}

                          <button 
                            onClick={handleResetWallpaper}
                            className="w-full mt-2 bg-white/5 hover:bg-white/10 text-white/80 px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-white/10"
                          >
                            Reset to Default Wallpaper
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : activeModal === 'files' ? (
                  <div className="h-full flex flex-col">
                    <div className="px-4 md:px-6 py-3 bg-black/20 flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm text-white/40">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <button onClick={() => fetchFiles(path.dirname(currentPath))} className="hover:text-white shrink-0"><ChevronLeft size={16} /></button>
                        <span className="font-mono truncate">{currentPath}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/5">
                          <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'}`}
                          >
                            <Grid size={14} />
                          </button>
                          <button 
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'}`}
                          >
                            <List size={14} />
                          </button>
                        </div>
                        <button 
                          onClick={() => setIsCreatingFolder(true)}
                          className="bg-white/5 hover:bg-white/10 text-white/80 px-3 py-1.5 md:py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                        >
                          <FolderPlus size={14} />
                          <span className="hidden sm:inline">New Folder</span>
                        </button>
                        <label className="bg-white/5 hover:bg-white/10 text-white/80 px-3 py-1.5 md:py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1">
                          <Upload size={14} />
                          <span className="hidden sm:inline">Upload</span>
                          <input 
                            type="file" 
                            multiple 
                            className="hidden" 
                            onChange={handleFileUpload}
                          />
                        </label>
                        {selectedFiles.size > 0 && (
                          <>
                            {showDeleteConfirm ? (
                              <div className="flex items-center gap-2 bg-red-500/20 px-2 py-1 rounded-lg border border-red-500/30">
                                <span className="text-xs text-red-200">Delete {selectedFiles.size} item(s)?</span>
                                <button 
                                  onClick={handleDeleteSelected}
                                  className="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
                                >
                                  Yes
                                </button>
                                <button 
                                  onClick={() => setShowDeleteConfirm(false)}
                                  className="bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <>
                                <button 
                                  onClick={handleDownloadSelected}
                                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 md:py-1 rounded-lg text-xs font-medium transition-colors"
                                >
                                  Download ({selectedFiles.size})
                                </button>
                                <button 
                                  onClick={() => setShowDeleteConfirm(true)}
                                  className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 md:py-1 rounded-lg text-xs font-medium transition-colors"
                                >
                                  Delete ({selectedFiles.size})
                                </button>
                              </>
                            )}
                          </>
                        )}
                        <button 
                          onClick={() => {
                            setIsSelectMode(!isSelectMode);
                            if (isSelectMode) {
                              setSelectedFiles(new Set());
                              setShowDeleteConfirm(false);
                            }
                          }}
                          className={`px-3 py-1.5 md:py-1 rounded-lg text-xs font-medium transition-colors ${isSelectMode ? 'bg-white/20 text-white' : 'bg-white/5 hover:bg-white/10 text-white/60'}`}
                        >
                          {isSelectMode ? 'Cancel' : 'Select'}
                        </button>
                      </div>
                    </div>
                    {fileError && (
                      <div className="bg-red-500/10 border-b border-red-500/20 px-4 md:px-6 py-2 flex items-center justify-between text-red-400 text-xs">
                        <span>{fileError}</span>
                        <button onClick={() => setFileError(null)} className="hover:text-red-300 transition-colors"><X size={14} /></button>
                      </div>
                    )}
                    <div className="flex-1 flex overflow-hidden relative">
                      <div className={`flex-1 overflow-y-auto p-4 relative ${viewMode === 'grid' ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 content-start' : 'flex flex-col gap-1'}`}>
                        {viewMode === 'list' && files.length > 0 && (
                          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-white/40 border-b border-white/5 mb-2">
                            <div className="col-span-6 md:col-span-5">Name</div>
                            <div className="col-span-3 md:col-span-2 text-right">Size</div>
                            <div className="hidden md:block col-span-3">Modified</div>
                            <div className="col-span-3 md:col-span-2 text-right">Permissions</div>
                          </div>
                        )}
                        {files.map((file) => {
                        const isSelected = selectedFiles.has(file.name);
                        
                        const handleFileClick = () => {
                          if (isSelectMode) {
                            const newSelected = new Set(selectedFiles);
                            if (newSelected.has(file.name)) {
                              newSelected.delete(file.name);
                            } else {
                              newSelected.add(file.name);
                            }
                            setSelectedFiles(newSelected);
                          } else if (file.isDirectory) {
                            fetchFiles(path.join(currentPath, file.name));
                          } else {
                            setPreviewFile(file);
                          }
                        };

                        const handlePermissionsClick = (e: React.MouseEvent) => {
                          e.stopPropagation();
                          setEditingPermissionsFile(file);
                          let octal = 0;
                          const p = file.permissions;
                          if (p[1] === 'r') octal += 400;
                          if (p[2] === 'w') octal += 200;
                          if (p[3] === 'x') octal += 100;
                          if (p[4] === 'r') octal += 40;
                          if (p[5] === 'w') octal += 20;
                          if (p[6] === 'x') octal += 10;
                          if (p[7] === 'r') octal += 4;
                          if (p[8] === 'w') octal += 2;
                          if (p[9] === 'x') octal += 1;
                          setNewPermissions(octal.toString(8).padStart(3, '0'));
                        };

                        if (viewMode === 'list') {
                          return (
                            <div 
                              key={file.name}
                              onClick={handleFileClick}
                              className={`grid grid-cols-12 gap-4 px-4 py-2.5 rounded-lg items-center transition-colors cursor-pointer group relative ${isSelected ? 'bg-blue-500/20 ring-1 ring-blue-500/50' : 'hover:bg-white/5'}`}
                            >
                              <div className="col-span-6 md:col-span-5 flex items-center gap-3 overflow-hidden">
                                {isSelectMode && (
                                  <div className={`w-4 h-4 shrink-0 rounded border ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-white/40'} flex items-center justify-center`}>
                                    {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                                  </div>
                                )}
                                {file.isDirectory ? (
                                  <FolderOpen size={16} className="text-blue-400 shrink-0" />
                                ) : (
                                  <File size={16} className="text-white/40 shrink-0" />
                                )}
                                <span className="text-sm truncate">{file.name}</span>
                              </div>
                              <div className="col-span-3 md:col-span-2 text-right text-xs text-white/50">
                                {file.isDirectory ? '--' : (file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${(file.size / 1024).toFixed(1)} KB`)}
                              </div>
                              <div className="hidden md:block col-span-3 text-xs text-white/50 truncate">
                                {new Date(file.modified).toLocaleString()}
                              </div>
                              <div 
                                className="col-span-3 md:col-span-2 text-right text-xs font-mono text-white/40 hover:text-white transition-colors"
                                onClick={handlePermissionsClick}
                              >
                                {file.permissions}
                              </div>
                            </div>
                          );
                        }

                        return (
                        <div 
                          key={file.name}
                          onClick={handleFileClick}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-colors cursor-pointer group relative ${isSelected ? 'bg-blue-500/20 ring-2 ring-blue-500' : 'hover:bg-white/5'}`}
                        >
                          {isSelectMode && (
                            <div className={`absolute top-2 left-2 w-4 h-4 rounded border ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-white/40'} flex items-center justify-center`}>
                              {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                            </div>
                          )}
                          {file.isDirectory ? (
                            <FolderOpen size={48} className="text-blue-400 group-hover:scale-110 transition-transform" />
                          ) : (
                            <File size={48} className="text-white/20 group-hover:scale-110 transition-transform" />
                          )}
                          <span className="text-xs text-center truncate w-full">{file.name}</span>
                          <div 
                            className="text-[10px] text-white/40 font-mono hover:text-white transition-colors flex items-center gap-1"
                            onClick={handlePermissionsClick}
                          >
                            {file.permissions}
                          </div>
                        </div>
                      )})}
                      </div>
                      
                      {previewFile && (
                        <div className="absolute inset-y-0 right-0 w-full md:relative md:w-80 border-l border-white/10 bg-[#1a1a1a] md:bg-black/20 flex flex-col overflow-hidden shrink-0 z-20">
                          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
                            <h3 className="font-bold truncate text-sm text-white/90">{previewFile.name}</h3>
                            <button onClick={() => setPreviewFile(null)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white">
                              <X size={14} />
                            </button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {(() => {
                              const ext = path.extname(previewFile.name).toLowerCase();
                              const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext);
                              const isText = ['.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.csv', '.log', '.env'].includes(ext);
                              
                              if (isImage) {
                                const handleRotate = (direction: 'left' | 'right') => {
                                  setImageRotation(prev => {
                                    let newRotation = prev + (direction === 'right' ? 90 : -90);
                                    if (newRotation >= 360) newRotation -= 360;
                                    if (newRotation < 0) newRotation += 360;
                                    return newRotation;
                                  });
                                };

                                const handleSaveRotation = async () => {
                                  if (!previewContent || imageRotation === 0) return;
                                  
                                  try {
                                    setIsPreviewLoading(true);
                                    
                                    // Create an image element to draw to canvas
                                    const img = new Image();
                                    img.crossOrigin = "anonymous";
                                    
                                    await new Promise((resolve, reject) => {
                                      img.onload = resolve;
                                      img.onerror = reject;
                                      img.src = previewContent;
                                    });
                                    
                                    const canvas = document.createElement('canvas');
                                    const ctx = canvas.getContext('2d');
                                    if (!ctx) throw new Error("Could not get canvas context");
                                    
                                    // Set canvas dimensions based on rotation
                                    if (imageRotation === 90 || imageRotation === 270) {
                                      canvas.width = img.height;
                                      canvas.height = img.width;
                                    } else {
                                      canvas.width = img.width;
                                      canvas.height = img.height;
                                    }
                                    
                                    ctx.translate(canvas.width / 2, canvas.height / 2);
                                    ctx.rotate((imageRotation * Math.PI) / 180);
                                    ctx.drawImage(img, -img.width / 2, -img.height / 2);
                                    
                                    // Get blob from canvas
                                    const blob = await new Promise<Blob>((resolve, reject) => {
                                      canvas.toBlob((b) => {
                                        if (b) resolve(b);
                                        else reject(new Error("Canvas toBlob failed"));
                                      }, 'image/png'); // Default to png to preserve quality/transparency
                                    });
                                    
                                    // Upload the rotated image
                                    const formData = new FormData();
                                    formData.append('path', currentPath);
                                    formData.append('files', blob, previewFile.name);
                                    
                                    const response = await fetch('/api/files/upload', {
                                      method: 'POST',
                                      headers: { ...getAuthHeaders() },
                                      credentials: 'include',
                                      body: formData
                                    });
                                    
                                    if (response.ok) {
                                      setImageRotation(0);
                                      fetchFiles(currentPath);
                                      // The preview will auto-refresh because fetchFiles updates the file list
                                      // and we might need to re-trigger the preview fetch.
                                      // For now, just clear the preview to force a refresh when clicked again,
                                      // or we can just let it be and the user can re-click.
                                      setPreviewFile(null);
                                    } else {
                                      const errorData = await response.json().catch(() => ({}));
                                      setFileError(errorData.error || "Failed to save rotated image.");
                                    }
                                  } catch (error: any) {
                                    console.error("Error saving rotation:", error);
                                    setFileError(error.message || "Failed to process image rotation.");
                                  } finally {
                                    setIsPreviewLoading(false);
                                  }
                                };

                                return (
                                  <div className="flex flex-col items-center gap-4">
                                    {isPreviewLoading ? (
                                      <div className="w-full aspect-video bg-black/40 rounded border border-white/5 flex items-center justify-center">
                                        <div className="text-xs text-white/40 animate-pulse">Processing image...</div>
                                      </div>
                                    ) : previewContent === "Failed to load file content." || previewContent === "Error loading file content." ? (
                                      <div className="w-full aspect-video bg-red-500/10 rounded border border-red-500/20 flex items-center justify-center">
                                        <div className="text-xs text-red-400">{previewContent}</div>
                                      </div>
                                    ) : previewContent ? (
                                      <div className="relative group overflow-hidden rounded border border-white/10 flex items-center justify-center bg-black/40 min-h-[200px] w-full">
                                        <img 
                                          src={previewContent} 
                                          alt={previewFile.name}
                                          className="max-w-full max-h-[400px] object-contain transition-transform duration-300"
                                          style={{ transform: `rotate(${imageRotation}deg)` }}
                                        />
                                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity border border-white/10">
                                          <button onClick={() => handleRotate('left')} className="p-1 hover:bg-white/20 rounded text-white/80 hover:text-white transition-colors" title="Rotate Left">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                                          </button>
                                          <button onClick={() => handleRotate('right')} className="p-1 hover:bg-white/20 rounded text-white/80 hover:text-white transition-colors" title="Rotate Right">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                                          </button>
                                          {imageRotation !== 0 && (
                                            <>
                                              <div className="w-px h-4 bg-white/20 mx-1"></div>
                                              <button onClick={handleSaveRotation} className="text-xs font-medium text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-white/10 transition-colors">
                                                Save
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    ) : null}
                                    <div className="text-xs text-white/40 font-mono w-full space-y-1">
                                      <div className="flex justify-between"><span>Size:</span> <span>{(previewFile.size / 1024).toFixed(1)} KB</span></div>
                                      <div className="flex justify-between"><span>Modified:</span> <span>{new Date(previewFile.modified).toLocaleDateString()}</span></div>
                                    </div>
                                  </div>
                                );
                              }
                              
                              if (isText) {
                                const languageMap: Record<string, string> = {
                                  '.js': 'javascript',
                                  '.jsx': 'jsx',
                                  '.ts': 'typescript',
                                  '.tsx': 'tsx',
                                  '.json': 'json',
                                  '.html': 'html',
                                  '.css': 'css',
                                  '.md': 'markdown',
                                  '.csv': 'csv',
                                  '.log': 'log',
                                  '.env': 'bash'
                                };
                                const language = languageMap[ext] || 'text';

                                return (
                                  <div className="flex flex-col h-full gap-4">
                                    <div className="text-xs text-white/40 font-mono w-full space-y-1 shrink-0">
                                      <div className="flex justify-between"><span>Size:</span> <span>{(previewFile.size / 1024).toFixed(1)} KB</span></div>
                                      <div className="flex justify-between"><span>Modified:</span> <span>{new Date(previewFile.modified).toLocaleDateString()}</span></div>
                                    </div>
                                    <div className="flex-1 bg-black/40 rounded-lg border border-white/5 overflow-hidden flex flex-col">
                                      {isPreviewLoading ? (
                                        <div className="p-3 text-xs text-white/40 animate-pulse">Loading content...</div>
                                      ) : previewContent === "Failed to load file content." || previewContent === "Error loading file content." ? (
                                        <div className="p-3 text-xs text-red-400">{previewContent}</div>
                                      ) : (
                                        <SyntaxHighlighter 
                                          language={language} 
                                          style={vscDarkPlus}
                                          customStyle={{ margin: 0, padding: '0.75rem', fontSize: '0.75rem', background: 'transparent', flex: 1, overflow: 'auto' }}
                                          wrapLines={true}
                                          wrapLongLines={true}
                                        >
                                          {previewContent || ''}
                                        </SyntaxHighlighter>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              
                              return (
                                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                                  <File size={48} className="text-white/20" />
                                  <div className="space-y-2 w-full">
                                    <div className="text-sm font-medium text-white/80">No preview available</div>
                                    <div className="text-xs text-white/40 font-mono bg-black/40 p-3 rounded-lg border border-white/5 space-y-2 text-left">
                                      <div className="flex justify-between"><span>Type:</span> <span>{ext || 'Unknown'}</span></div>
                                      <div className="flex justify-between"><span>Size:</span> <span>{(previewFile.size / 1024).toFixed(1)} KB</span></div>
                                      <div className="flex justify-between"><span>Created:</span> <span>{new Date(previewFile.created).toLocaleString()}</span></div>
                                      <div className="flex justify-between"><span>Modified:</span> <span>{new Date(previewFile.modified).toLocaleString()}</span></div>
                                      <div className="flex justify-between"><span>Accessed:</span> <span>{new Date(previewFile.accessed).toLocaleString()}</span></div>
                                      <div className="flex justify-between"><span>Permissions:</span> <span>{previewFile.permissions}</span></div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                      
                      {editingPermissionsFile && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/10 w-[420px] shadow-2xl">
                            <h3 className="text-lg font-bold mb-4">Edit Permissions</h3>
                            <p className="text-sm text-white/60 mb-4 truncate">File: {editingPermissionsFile.name}</p>
                            <div className="mb-6">
                              <label className="block text-xs text-white/60 mb-3 uppercase tracking-wider">
                                Permissions
                              </label>
                              <div className="space-y-2">
                                {[
                                  { label: 'Owner', index: 0 },
                                  { label: 'Group', index: 1 },
                                  { label: 'Others', index: 2 }
                                ].map((entity) => {
                                  const val = parseInt(newPermissions[entity.index] || '0', 10);
                                  const toggleBit = (bit: number) => {
                                    const current = parseInt(newPermissions[entity.index] || '0', 10);
                                    const updated = current ^ bit;
                                    const arr = (newPermissions || '000').padStart(3, '0').split('');
                                    arr[entity.index] = updated.toString();
                                    setNewPermissions(arr.join(''));
                                  };
                                  return (
                                    <div key={entity.label} className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                                      <span className="text-sm text-white/80 w-20 font-medium">{entity.label}</span>
                                      <div className="flex gap-4">
                                        <label className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-white transition-colors text-white/60">
                                          <input type="checkbox" checked={!!(val & 4)} onChange={() => toggleBit(4)} className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-blue-500/50" />
                                          Read
                                        </label>
                                        <label className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-white transition-colors text-white/60">
                                          <input type="checkbox" checked={!!(val & 2)} onChange={() => toggleBit(2)} className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-blue-500/50" />
                                          Write
                                        </label>
                                        <label className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-white transition-colors text-white/60">
                                          <input type="checkbox" checked={!!(val & 1)} onChange={() => toggleBit(1)} className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-blue-500/50" />
                                          Execute
                                        </label>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-4 flex items-center justify-between text-xs text-white/40 px-1">
                                <span>Octal Value:</span>
                                <span className="font-mono bg-black/30 px-2 py-1 rounded border border-white/5">{newPermissions.padStart(3, '0')}</span>
                              </div>
                            </div>
                            <div className="flex justify-end gap-3">
                              <button 
                                onClick={() => setEditingPermissionsFile(null)}
                                className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={handlePermissionsChange}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {isCreatingFolder && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/10 w-80 shadow-2xl">
                            <h3 className="text-lg font-bold mb-4">New Folder</h3>
                            <div className="mb-6">
                              <label className="block text-xs text-white/60 mb-2 uppercase tracking-wider">
                                Folder Name
                              </label>
                              <input 
                                type="text" 
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="e.g. projects"
                                className="w-full bg-black/20 border border-white/10 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCreateDirectory();
                                  if (e.key === 'Escape') {
                                    setIsCreatingFolder(false);
                                    setNewFolderName('');
                                  }
                                }}
                              />
                            </div>
                            <div className="flex justify-end gap-3">
                              <button 
                                onClick={() => {
                                  setIsCreatingFolder(false);
                                  setNewFolderName('');
                                }}
                                className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={handleCreateDirectory}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                              >
                                Create
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <Terminal isActive={activeModal === 'terminal'} />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Floating Dock */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20">
        <div className="px-6 py-3 rounded-3xl bg-black/40 backdrop-blur-2xl border border-white/10 flex items-center gap-6 shadow-2xl">
          <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all text-blue-400">
            <LayoutGrid size={24} />
          </button>
          <div className="w-px h-6 bg-white/10" />
          <button onClick={() => { setActiveModal('files'); fetchFiles(); }} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <FolderOpen size={24} />
          </button>
          <button onClick={() => setActiveModal('terminal')} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <TerminalIcon size={24} />
          </button>
          <button onClick={() => setActiveModal('settings')} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <Settings size={24} />
          </button>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
