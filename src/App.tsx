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
  Grid,
  FileText,
  Download,
  MoreHorizontal,
  ArrowUpRight,
  Folder,
  Archive,
  Code,
  FileJson,
  FileCode,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FilePenLine,
  Laptop,
  RotateCw,
  RotateCcw,
  Database as DatabaseIcon,
  Settings as SettingsIcon,
  ClipboardList,
  Menu,
  Eye,
  CheckCircle2,
  AlertCircle
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
  value: any;
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

interface UploadTask {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

// Path helpers for frontend
const path = {
  dirname: (p: string) => p.split('/').slice(0, -1).join('/') || '/',
  join: (...parts: string[]) => parts.join('/').replace(/\/+/g, '/'),
  extname: (p: string) => {
    const match = p.match(/\.[^.]+$/);
    return match ? match[0] : '';
  },
  basename: (p: string) => p.split('/').pop() || ''
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
import { getFileIcon } from './components/FileIcon';

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
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [hiddenAppIds, setHiddenAppIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('casadash_hidden_apps');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameFile, setRenameFile] = useState<FileItem | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [moveFile, setMoveFile] = useState<FileItem | null>(null);
  const [moveDestination, setMoveDestination] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [showUploadComplete, setShowUploadComplete] = useState(false);
  const [editingPermissionsFile, setEditingPermissionsFile] = useState<FileItem | null>(null);
  const [newPermissions, setNewPermissions] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [imageRotation, setImageRotation] = useState(0);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useEffect(() => {
    setImageRotation(0);
    
    if (previewFile && previewFile.name.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)$/i)) {
      const loadImg = async () => {
        setIsPreviewLoading(true);
        try {
          const response = await fetch(`/api/files/raw?path=${encodeURIComponent(path.join(currentPath, previewFile.name))}`, {
            headers: getAuthHeaders()
          });
          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setPreviewImageUrl(url);
          } else {
            setPreviewImageUrl(null);
          }
        } catch (e) {
          console.error("Failed to load preview image:", e);
          setPreviewImageUrl(null);
        } finally {
          setIsPreviewLoading(false);
        }
      };
      loadImg();
    } else {
      if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
        setPreviewImageUrl(null);
      }
    }

    return () => {
      // Note: We don't revoke here because it might still be needed by the component
      // Revocation is handled in the next effect run or when previewFile becomes null
    };
  }, [previewFile]);

  // Separate effect for cleanup to avoid revoking while still in use
  useEffect(() => {
    return () => {
      if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
      }
    };
  }, [previewImageUrl]);

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

  const getMediaUrl = (filePath: string) => {
    const token = localStorage.getItem('auth_token');
    const baseUrl = `/api/files/raw?path=${encodeURIComponent(filePath)}`;
    return token ? `${baseUrl}&token=${token}` : baseUrl;
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
      const isText = ['.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.csv', '.log', '.env', '.py', '.sh', '.yaml', '.yml', '.xml'].includes(ext);
      
      if (isText) {
        setIsPreviewLoading(true);
        try {
          const filePath = path.join(currentPath, previewFile.name);
          const response = await fetch(`/api/files/raw?path=${encodeURIComponent(filePath)}`, {
            headers: { ...getAuthHeaders() },
            credentials: 'include'
          });
          if (response.ok) {
            const text = await response.text();
            setPreviewContent(text);
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
        setLoginError('Incorrect password, try again');
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
        setFileError(errorData.error + (errorData.details ? `: ${errorData.details}` : "") || "Failed to fetch files. Permission denied or path does not exist.");
      }
    } catch (error: any) {
      console.error("Failed to fetch files:", error);
      setFileError(error.message || "Network error while fetching files.");
    }
  };

  const handleDownload = async (filePath: string) => {
    setFileError(null);
    try {
      const response = await fetch(`/api/files/download?path=${encodeURIComponent(filePath)}`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = path.basename(filePath);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      setFileError(error.message || "Failed to download file");
    }
  };

  const handleDownloadSelected = async () => {
    if (selectedFiles.size === 0) return;
    setFileError(null);
    
    const filePaths = Array.from(selectedFiles).map((name: string) => path.join(currentPath, name));
    
    try {
      for (const filePath of filePaths) {
        const response = await fetch(`/api/files/download?path=${encodeURIComponent(filePath)}`, {
          headers: getAuthHeaders()
        });
        
        if (!response.ok) {
          throw new Error(`Failed to download: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = path.basename(filePath);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        // Small delay to prevent browser from blocking multiple downloads
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Reset selection
      setSelectedFiles(new Set());
      setIsSelectMode(false);
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

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const handleCreateFolder = async () => {
    if (!newFolderName) return;
    try {
      const response = await fetch('/api/files/mkdir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ targetPath: currentPath, name: newFolderName })
      });
      if (response.ok) {
        setIsCreatingFolder(false);
        setNewFolderName('');
        fetchFiles(currentPath);
      } else {
        const data = await response.json().catch(() => ({}));
        setFileError(data.error || "Failed to create folder");
      }
    } catch (error: any) {
      setFileError(error.message || "Failed to create folder");
    }
  };

  const handleRename = async () => {
    if (!renameFile || !newFileName) return;
    try {
      const response = await fetch('/api/files/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ 
          oldPath: path.join(currentPath, renameFile.name),
          newPath: path.join(currentPath, newFileName)
        })
      });
      if (response.ok) {
        setRenameFile(null);
        setNewFileName('');
        fetchFiles(currentPath);
      } else {
        const data = await response.json().catch(() => ({}));
        setFileError(data.error || "Failed to rename file");
      }
    } catch (error: any) {
      setFileError(error.message || "Failed to rename file");
    }
  };

  const handleMove = async () => {
    if (!moveFile || !moveDestination) return;
    try {
      const response = await fetch('/api/files/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ 
          oldPath: path.join(currentPath, moveFile.name),
          newPath: path.join(moveDestination, moveFile.name)
        })
      });
      if (response.ok) {
        setMoveFile(null);
        setMoveDestination('');
        fetchFiles(currentPath);
      } else {
        const data = await response.json().catch(() => ({}));
        setFileError(data.error || "Failed to move file");
      }
    } catch (error: any) {
      setFileError(error.message || "Failed to move file");
    }
  };

  const handleDragDropMove = async (sourceFileName: string, destinationFolderName: string) => {
    try {
      const response = await fetch('/api/files/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ 
          oldPath: path.join(currentPath, sourceFileName),
          newPath: path.join(currentPath, destinationFolderName, sourceFileName)
        })
      });
      if (response.ok) {
        fetchFiles(currentPath);
      } else {
        const data = await response.json().catch(() => ({}));
        setFileError(data.error || "Failed to move file");
      }
    } catch (error: any) {
      setFileError(error.message || "Failed to move file");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setFileError(null);
    setShowUploadComplete(false);
    
    const filesToUpload = Array.from(e.target.files);
    const newTasks: UploadTask[] = filesToUpload.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      fileName: file.name,
      progress: 0,
      status: 'uploading'
    }));

    setUploadTasks(prev => [...prev, ...newTasks]);

    const uploadFile = (file: File, task: UploadTask) => {
      return new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('files', file);

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadTasks(prev => prev.map(t => 
              t.id === task.id ? { ...t, progress: percent } : t
            ));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadTasks(prev => prev.map(t => 
              t.id === task.id ? { ...t, status: 'completed', progress: 100 } : t
            ));
            resolve();
          } else {
            let errorMsg = `Upload failed (${xhr.status})`;
            try {
              const response = JSON.parse(xhr.responseText);
              errorMsg = response.error || errorMsg;
            } catch (e) {
              if (xhr.status === 413) {
                errorMsg = "File is too large for the server to process (Max 5GB). The request was likely rejected by a proxy or firewall.";
              } else if (xhr.responseText) {
                errorMsg = xhr.responseText.length > 100 
                  ? xhr.responseText.substring(0, 100) + '...' 
                  : xhr.responseText;
              }
            }
            
            console.error(`[FRONTEND] Upload error (${xhr.status}):`, xhr.responseText);
            setUploadTasks(prev => prev.map(t => 
              t.id === task.id ? { ...t, status: 'error', error: errorMsg } : t
            ));
            reject(new Error(errorMsg));
          }
        });

        xhr.addEventListener('error', () => {
          const errorMsg = "Network error or request blocked";
          setUploadTasks(prev => prev.map(t => 
            t.id === task.id ? { ...t, status: 'error', error: errorMsg } : t
          ));
          reject(new Error(errorMsg));
        });

        xhr.open('POST', '/api/files/upload');
        const headers = getAuthHeaders();
        Object.entries(headers).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value as string);
        });
        console.log(`[FRONTEND] Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) to: ${currentPath || 'default home'}`);
        xhr.setRequestHeader('x-target-dir', currentPath);
        xhr.withCredentials = true;
        xhr.send(formData);
      });
    };

    try {
      const results = await Promise.allSettled(filesToUpload.map((file, index) => uploadFile(file, newTasks[index])));
      fetchFiles(currentPath);
      
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed.length === 0) {
        setShowUploadComplete(true);
        setTimeout(() => setShowUploadComplete(false), 5000);
      } else {
        const firstError = failed[0].reason?.message || "Unknown upload error";
        console.error(`${failed.length} uploads failed. First error: ${firstError}`);
        setFileError(`${failed.length} file(s) failed to upload: ${firstError}`);
      }
    } catch (error) {
      console.error("Unexpected error during upload process:", error);
      setFileError("An unexpected error occurred during upload.");
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

  const toggleAppVisibility = (appId: string) => {
    if (['files', 'terminal', 'settings'].includes(appId)) return;
    setHiddenAppIds(prev => {
      const next = new Set(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        next.add(appId);
      }
      localStorage.setItem('casadash_hidden_apps', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const apps: AppIcon[] = [
    { id: 'files', name: 'Files', icon: <FolderOpen size={32} />, color: 'bg-blue-500', action: () => { setActiveModal('files'); fetchFiles('/home'); } },
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

  const filteredApps: AppIconWithMatches[] = (searchQuery
    ? fuse.search(searchQuery).map(result => ({
        ...result.item,
        matches: result.matches
      }))
    : apps).filter(app => isEditMode || !hiddenAppIds.has(app.id));

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

  const renderSidebarContent = (isMobile = false) => (
    <>
      <div className="p-4">
        <h3 className="text-xs font-semibold text-white/40 mb-3 tracking-wider uppercase">Quick Access</h3>
        <div className="space-y-1">
          {[
            { path: 'HOME', icon: <Home size={18} />, label: 'Home' },
            { path: 'Documents', icon: <FileText size={18} />, label: 'Documents' },
            { path: 'Images', icon: <ImageIcon size={18} />, label: 'Images' },
            { path: 'Downloads', icon: <Download size={18} />, label: 'Downloads' },
          ].map((item) => (
            <button 
              key={item.path}
              onClick={() => {
                fetchFiles(item.path);
                if (isMobile) setIsSidebarOpen(false);
              }} 
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const sourceFileName = e.dataTransfer.getData('text/plain');
                if (sourceFileName) {
                  try {
                    const response = await fetch('/api/files/rename', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                      },
                      body: JSON.stringify({ 
                        oldPath: path.join(currentPath, sourceFileName),
                        newPath: path.join(item.path, sourceFileName)
                      })
                    });
                    if (response.ok) {
                      fetchFiles(currentPath);
                    } else {
                      const data = await response.json().catch(() => ({}));
                      setFileError(data.error || "Failed to move file");
                    }
                  } catch (error: any) {
                    setFileError(error.message || "Failed to move file");
                  }
                }
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${currentPath === item.path ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-xs font-semibold text-white/40 mb-3 tracking-wider uppercase">Storage</h3>
        <div className="space-y-1">
          {[
            { path: '/', icon: <HardDrive size={18} />, label: '/' },
            { path: '/mnt', icon: <HardDrive size={18} />, label: '/mnt' },
          ].map((item) => (
            <button 
              key={item.path}
              onClick={() => {
                fetchFiles(item.path);
                if (isMobile) setIsSidebarOpen(false);
              }} 
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const sourceFileName = e.dataTransfer.getData('text/plain');
                if (sourceFileName) {
                  try {
                    const response = await fetch('/api/files/rename', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                      },
                      body: JSON.stringify({ 
                        oldPath: path.join(currentPath, sourceFileName),
                        newPath: path.join(item.path, sourceFileName)
                      })
                    });
                    if (response.ok) {
                      fetchFiles(currentPath);
                    } else {
                      const data = await response.json().catch(() => ({}));
                      setFileError(data.error || "Failed to move file");
                    }
                  } catch (error: any) {
                    setFileError(error.message || "Failed to move file");
                  }
                }
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${currentPath === item.path ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-auto p-4 border-t border-white/10">
         <p className="text-xs text-white/40">Disk usage</p>
         <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
           <div className="h-full bg-blue-500" style={{ width: `${systemStats.disk.usagePercent}%` }}></div>
         </div>
      </div>
    </>
  );

  const renderFileInfoContent = () => {
    const selectedFileObj = selectedFiles.size === 1 ? files.find(f => f.name === Array.from(selectedFiles)[0]) : null;
    if (selectedFileObj) {
      return (
        <>
          <div className="flex justify-between items-start mb-6">
            <div className="w-16 h-16 bg-white/5 rounded-xl flex items-center justify-center">
              {getFileIcon(selectedFileObj, 32)}
            </div>
            <button 
              onClick={() => setSelectedFiles(new Set())}
              className="text-white/40 hover:text-white transition-colors"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
          <h2 className="text-xl font-semibold mb-8 truncate" title={selectedFileObj.name}>{selectedFileObj.name}</h2>
          
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-white/40 mb-4 tracking-wider uppercase">File Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-white/60">Size</span><span>{formatBytes(selectedFileObj.size)}</span></div>
              <div className="flex justify-between"><span className="text-white/60">Modified</span><span>{new Date(selectedFileObj.modified).toLocaleDateString()}</span></div>
              <div className="flex justify-between"><span className="text-white/60">Owner</span><span>root</span></div>
              <div className="flex justify-between"><span className="text-white/60">Perms</span><span className="font-mono">{selectedFileObj.permissions}</span></div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-white/40 mb-4 tracking-wider uppercase">Metadata DB</h3>
            <p className="text-sm text-white/60">No tags yet</p>
            <p className="text-sm text-white/40 mt-2">--</p>
          </div>
        </>
      );
    } else if (selectedFiles.size > 1) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-white/40 relative">
          <button 
            onClick={() => setSelectedFiles(new Set())}
            className="absolute top-0 right-0 text-white/40 hover:text-white transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
          <ClipboardList size={48} className="mb-4 opacity-20" />
          <p>{selectedFiles.size} files selected</p>
        </div>
      );
    }
    return null;
  };

  const renderFileInfoActions = () => {
    if (selectedFiles.size === 0) return null;
    return (
      <div className="p-4 border-t border-white/10 space-y-2">
        {selectedFiles.size === 1 && (() => {
          const selectedFileObj = files.find(f => f.name === Array.from(selectedFiles)[0]);
          if (!selectedFileObj) return null;
          return (
            <>
              {!selectedFileObj.isDirectory && (
                <button 
                  onClick={() => {
                    setPreviewFile(selectedFileObj);
                    setShowInfoPanel(false);
                    if (window.innerWidth < 768) {
                      setSelectedFiles(new Set());
                    }
                  }} 
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-lg shadow-blue-500/20"
                >
                  Preview <Eye size={16} />
                </button>
              )}
              <button 
                onClick={() => { 
                  setRenameFile(selectedFileObj); 
                  setNewFileName(selectedFileObj.name); 
                  if (window.innerWidth < 768) {
                    setSelectedFiles(new Set());
                  }
                }} 
                className="w-full py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                Rename <ArrowUpRight size={16} className="text-white/40" />
              </button>
              <button 
                onClick={() => { 
                  setMoveFile(selectedFileObj); 
                  setMoveDestination(currentPath); 
                  if (window.innerWidth < 768) {
                    setSelectedFiles(new Set());
                  }
                }} 
                className="w-full py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                Move <ArrowUpRight size={16} className="text-white/40" />
              </button>
            </>
          );
        })()}
        <button onClick={handleDownloadSelected} className="w-full py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-colors flex items-center justify-center gap-2 text-sm font-medium">
          Download <Download size={16} className="text-white/40" />
        </button>
        {showDeleteConfirm ? (
          <div className="w-full p-3 rounded-xl border border-red-500/30 bg-red-500/10 flex flex-col gap-2">
            <p className="text-sm text-red-200 text-center">Delete {selectedFiles.size} item(s)?</p>
            <div className="flex gap-2">
              <button onClick={handleDeleteSelected} className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors">Yes</button>
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors">No</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowDeleteConfirm(true)} className="w-full py-2.5 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2 text-sm font-medium">
            Delete <X size={16} className="text-red-400/60" />
          </button>
        )}
      </div>
    );
  };

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
              <h2 className="text-2xl font-bold tracking-tight">
                {isEditMode ? 'Manage Apps' : 'Installed Apps'}
              </h2>
              <button 
                onClick={() => setIsEditMode(!isEditMode)}
                className={`text-sm font-medium transition-colors flex items-center gap-1 ${isEditMode ? 'text-emerald-400 hover:text-emerald-300' : 'text-blue-400 hover:text-blue-300'}`}
              >
                {isEditMode ? 'Done Managing' : 'Manage Apps'} <Settings size={14} />
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
                    whileHover={isEditMode ? {} : { y: -8 }}
                    onClick={() => !isEditMode && app.action?.()}
                    className={`group flex flex-col items-center gap-2 md:gap-4 cursor-pointer relative ${isEditMode && hiddenAppIds.has(app.id) ? 'opacity-40' : ''}`}
                  >
                    <div className={`w-16 h-16 md:w-20 md:h-20 ${app.color} rounded-2xl md:rounded-3xl flex items-center justify-center shadow-2xl shadow-black/40 group-hover:shadow-blue-500/20 transition-all duration-300 relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      {app.icon}
                      
                      {isEditMode && !['files', 'terminal', 'settings'].includes(app.id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAppVisibility(app.id);
                          }}
                          className={`absolute top-1 right-1 p-1 rounded-full shadow-lg transition-transform hover:scale-110 z-10 ${hiddenAppIds.has(app.id) ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}
                        >
                          {hiddenAppIds.has(app.id) ? <CheckCircle2 size={12} /> : <X size={12} />}
                        </button>
                      )}
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
              {activeModal !== 'files' && (
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                  <div className="flex items-center gap-3">
                    {activeModal === 'settings' ? <Settings className="text-slate-400" /> :
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
              )}

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

                      {hiddenAppIds.size > 0 && (
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                          <h4 className="text-sm font-bold text-white/80 mb-4 flex items-center gap-2">
                            <LayoutGrid size={16} /> Hidden Apps
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {apps.filter(app => hiddenAppIds.has(app.id)).map(app => (
                              <div key={app.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                                <span className="text-xs text-white/60">{app.name}</span>
                                <button 
                                  onClick={() => toggleAppVisibility(app.id)}
                                  className="text-[10px] text-blue-400 hover:text-blue-300 font-medium"
                                >
                                  Restore
                                </button>
                              </div>
                            ))}
                          </div>
                          <button 
                            onClick={() => {
                              setHiddenAppIds(new Set());
                              localStorage.removeItem('casadash_hidden_apps');
                            }}
                            className="w-full mt-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs transition-colors"
                          >
                            Restore All Apps
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : activeModal === 'files' ? (
                  <div className="h-full flex bg-[#1e1e1e] text-white">
                    {/* Left Sidebar - Desktop */}
                    <div className="hidden md:flex w-64 bg-[#1a1a1a] border-r border-white/10 flex-col shrink-0">
                      {renderSidebarContent()}
                    </div>

                    {/* Left Sidebar - Mobile Drawer */}
                    <AnimatePresence>
                      {isSidebarOpen && (
                        <>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSidebarOpen(false)}
                            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
                          />
                          <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 left-0 z-[70] w-72 bg-[#1a1a1a] shadow-2xl md:hidden flex flex-col"
                          >
                            <div className="p-4 border-b border-white/5 flex items-center justify-between">
                              <span className="font-bold">Quick Access</span>
                              <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                                <X size={20} />
                              </button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                              {renderSidebarContent(true)}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>

                    {/* Middle Column */}
                    <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
                      {/* Top Bar */}
                      <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 shrink-0">
                        <div className="flex items-center gap-2 text-sm overflow-hidden whitespace-nowrap">
                          <button 
                            onClick={() => setIsSidebarOpen(true)} 
                            className="md:hidden p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white shrink-0"
                          >
                            <Menu size={18} />
                          </button>
                          <button onClick={() => fetchFiles(path.dirname(currentPath))} className="text-white/40 hover:text-white shrink-0"><ChevronLeft size={16} /></button>
                          <span className="text-white/40 truncate flex items-center">
                            {currentPath.split('/').map((part, i, arr) => {
                              const targetPath = arr.slice(0, i + 1).join('/') || '/';
                              return (
                                <React.Fragment key={i}>
                                  <span 
                                    className="cursor-pointer hover:text-white transition-colors px-1 rounded-sm"
                                    onClick={() => fetchFiles(targetPath)}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                    }}
                                    onDrop={async (e) => {
                                      e.preventDefault();
                                      const sourceFileName = e.dataTransfer.getData('text/plain');
                                      if (sourceFileName) {
                                        try {
                                          const response = await fetch('/api/files/rename', {
                                            method: 'POST',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              ...getAuthHeaders()
                                            },
                                            body: JSON.stringify({ 
                                              oldPath: path.join(currentPath, sourceFileName),
                                              newPath: path.join(targetPath, sourceFileName)
                                            })
                                          });
                                          if (response.ok) {
                                            fetchFiles(currentPath);
                                          } else {
                                            const data = await response.json().catch(() => ({}));
                                            setFileError(data.error || "Failed to move file");
                                          }
                                        } catch (error: any) {
                                          setFileError(error.message || "Failed to move file");
                                        }
                                      }
                                    }}
                                  >
                                    {part || (i === 0 ? 'root' : '')}
                                  </span>
                                  {i < arr.length - 1 && <span className="mx-1">/</span>}
                                </React.Fragment>
                              );
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <motion.div 
                            initial={false}
                            animate={{ width: isSearchExpanded ? (window.innerWidth < 768 ? 160 : 240) : 36 }}
                            onHoverStart={() => setIsSearchExpanded(true)}
                            onHoverEnd={() => !fileSearchQuery && setIsSearchExpanded(false)}
                            className="relative h-9 bg-white/5 border border-white/10 rounded-lg overflow-hidden flex items-center"
                          >
                            <button 
                              onClick={() => {
                                if (isSearchExpanded && fileSearchQuery) {
                                  setFileSearchQuery('');
                                  setIsSearchExpanded(false);
                                } else {
                                  setIsSearchExpanded(!isSearchExpanded);
                                  if (!isSearchExpanded) {
                                    setTimeout(() => searchInputRef.current?.focus(), 100);
                                  }
                                }
                              }}
                              className="absolute left-0 top-0 bottom-0 w-9 flex items-center justify-center text-white/40 hover:text-white transition-colors z-10"
                            >
                              <Search size={16} />
                            </button>
                            <input 
                              ref={searchInputRef}
                              type="text" 
                              placeholder="Search files..." 
                              value={fileSearchQuery}
                              onChange={(e) => {
                                setFileSearchQuery(e.target.value);
                                if (!isSearchExpanded) setIsSearchExpanded(true);
                              }}
                              onFocus={() => setIsSearchExpanded(true)}
                              onBlur={() => !fileSearchQuery && setIsSearchExpanded(false)}
                              className="bg-transparent border-none pl-9 pr-9 py-1.5 text-sm text-white focus:outline-none w-full" 
                            />
                            {fileSearchQuery && (
                              <button 
                                onClick={() => {
                                  setFileSearchQuery('');
                                  setIsSearchExpanded(false);
                                  searchInputRef.current?.blur();
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/20 hover:text-white transition-colors"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </motion.div>
                          <div className="flex items-center gap-1 border-l border-white/10 pl-3">
                            <button onClick={() => setIsCreatingFolder(true)} className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors" title="New Folder">
                              <FolderPlus size={16} />
                            </button>
                            <label className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer" title="Upload">
                              <Upload size={16} />
                              <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                            </label>
                            <button onClick={() => setActiveModal(null)} className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors ml-2" title="Close">
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* File Grid */}
                      <div 
                        className="flex-1 overflow-y-auto p-6 relative"
                        onClick={() => {
                          setSelectedFiles(new Set());
                          setShowInfoPanel(false);
                        }}
                      >
                        {fileError && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4 flex items-center justify-between text-red-400 text-sm">
                            <span>{fileError}</span>
                            <button onClick={() => setFileError(null)} className="hover:text-red-300 transition-colors"><X size={16} /></button>
                          </div>
                        )}

                        {/* Upload Tasks Overlay */}
                        <AnimatePresence>
                          {(uploadTasks.length > 0 || showUploadComplete) && (
                            <motion.div 
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 20 }}
                              className="fixed bottom-6 right-6 z-[100] w-80 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                            >
                              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                  {showUploadComplete ? (
                                    <><CheckCircle2 size={16} className="text-green-500" /> Upload Complete</>
                                  ) : (
                                    <><Upload size={16} className="text-blue-500 animate-bounce" /> Uploading Files...</>
                                  )}
                                </h4>
                                <button 
                                  onClick={() => {
                                    setUploadTasks([]);
                                    setShowUploadComplete(false);
                                  }}
                                  className="text-white/40 hover:text-white transition-colors"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                              <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                                {uploadTasks.map(task => (
                                  <div key={task.id} className="p-2 rounded-lg bg-white/5 border border-white/5">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-xs font-medium truncate flex-1 pr-2">{task.fileName}</span>
                                      {task.status === 'completed' && <CheckCircle2 size={14} className="text-green-500 shrink-0" />}
                                      {task.status === 'error' && <AlertCircle size={14} className="text-red-500 shrink-0" />}
                                      {task.status === 'uploading' && <span className="text-[10px] text-white/40">{task.progress}%</span>}
                                    </div>
                                    {task.status === 'uploading' && (
                                      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                        <motion.div 
                                          initial={{ width: 0 }}
                                          animate={{ width: `${task.progress}%` }}
                                          className="h-full bg-blue-500"
                                        />
                                      </div>
                                    )}
                                    {task.status === 'error' && (
                                      <p className="text-[10px] text-red-400 truncate">{task.error}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 content-start">
                          {files.filter(f => f.name.toLowerCase().includes(fileSearchQuery.toLowerCase())).map((file) => {
                            const isSelected = selectedFiles.has(file.name);
                            return (
                              <div 
                                key={file.name}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', file.name);
                                }}
                                onDragOver={(e) => {
                                  if (file.isDirectory) {
                                    e.preventDefault();
                                  }
                                }}
                                onDrop={(e) => {
                                  if (file.isDirectory) {
                                    e.preventDefault();
                                    const sourceFileName = e.dataTransfer.getData('text/plain');
                                    if (sourceFileName && sourceFileName !== file.name) {
                                      handleDragDropMove(sourceFileName, file.name);
                                    }
                                  }
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // If Ctrl or Meta key is pressed, toggle selection instead of opening
                                  if (e.ctrlKey || e.metaKey) {
                                    const newSelected = new Set(selectedFiles);
                                    if (newSelected.has(file.name)) {
                                      newSelected.delete(file.name);
                                    } else {
                                      newSelected.add(file.name);
                                    }
                                    setSelectedFiles(newSelected);
                                    return;
                                  }

                                  if (file.isDirectory) {
                                    fetchFiles(path.join(currentPath, file.name));
                                  } else {
                                    const newSelected = new Set([file.name]);
                                    setSelectedFiles(newSelected);
                                    setPreviewFile(file);
                                  }
                                  setShowInfoPanel(false);
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const newSelected = new Set([file.name]);
                                  setSelectedFiles(newSelected);
                                  setShowInfoPanel(true);
                                }}
                                onDoubleClick={(e) => {
                                  e.preventDefault();
                                }}
                                className={`flex flex-col items-center justify-center p-3 md:p-6 rounded-xl cursor-pointer transition-all border ${isSelected ? 'bg-blue-500/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                              >
                                <div className="mb-2 md:mb-3">
                                  {getFileIcon(file, window.innerWidth < 768 ? 40 : 48)}
                                </div>
                                <span className="text-sm font-medium text-center break-all line-clamp-2 text-white/80">{file.name}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Modals for creating folder, renaming, moving, previewing */}
                        {isCreatingFolder && (
                          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10">
                            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                              <h3 className="text-lg font-bold text-white mb-4">Create New Folder</h3>
                              <input 
                                type="text"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Folder name"
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all mb-4"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                              />
                              <div className="flex gap-3">
                                <button 
                                  onClick={() => setIsCreatingFolder(false)}
                                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
                                >
                                  Cancel
                                </button>
                                <button 
                                  onClick={handleCreateFolder}
                                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                                >
                                  Create
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {renameFile && (
                          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10">
                            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                              <h3 className="text-lg font-bold text-white mb-4">Rename File</h3>
                              <input 
                                type="text"
                                value={newFileName}
                                onChange={(e) => setNewFileName(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all mb-4"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                              />
                              <div className="flex gap-3">
                                <button 
                                  onClick={() => setRenameFile(null)}
                                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
                                >
                                  Cancel
                                </button>
                                <button 
                                  onClick={handleRename}
                                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                                >
                                  Rename
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {moveFile && (
                          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10">
                            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                              <h3 className="text-lg font-bold text-white mb-4">Move File</h3>
                              <input 
                                type="text"
                                value={moveDestination}
                                onChange={(e) => setMoveDestination(e.target.value)}
                                placeholder="Destination path"
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all mb-4"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleMove()}
                              />
                              <div className="flex gap-3">
                                <button 
                                  onClick={() => setMoveFile(null)}
                                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
                                >
                                  Cancel
                                </button>
                                <button 
                                  onClick={handleMove}
                                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                                >
                                  Move
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {previewFile && (
                          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-20 p-4">
                            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                                <div className="flex items-center gap-2">
                                  {getFileIcon(previewFile, 20)}
                                  <span className="font-medium text-white">{previewFile.name}</span>
                                  {previewFile.name.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)$/i) && (
                                    <div className="flex items-center gap-1 ml-4 border-l border-white/10 pl-4">
                                      <button 
                                        onClick={() => setImageRotation(prev => (prev - 90) % 360)}
                                        className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                                        title="Rotate Left"
                                      >
                                        <RotateCcw size={16} />
                                      </button>
                                      <button 
                                        onClick={() => setImageRotation(prev => (prev + 90) % 360)}
                                        className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                                        title="Rotate Right"
                                      >
                                        <RotateCw size={16} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <button onClick={() => setPreviewFile(null)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors">
                                  <X size={18} />
                                </button>
                              </div>
                              <div className="flex-1 overflow-auto bg-black/40 p-4">
                                {previewFile.name.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)$/i) ? (
                                  <div className="w-full h-full flex items-center justify-center">
                                    {isPreviewLoading ? (
                                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    ) : previewImageUrl ? (
                                      <img 
                                        src={previewImageUrl} 
                                        alt={previewFile.name} 
                                        referrerPolicy="no-referrer"
                                        style={{ transform: `rotate(${imageRotation}deg)` }}
                                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-300" 
                                      />
                                    ) : (
                                      <div className="text-center text-white/40">
                                        <ImageIcon size={48} className="mx-auto mb-2 opacity-20" />
                                        <p>Failed to load image preview</p>
                                      </div>
                                    )}
                                  </div>
                                ) : previewFile.name.match(/\.(mp4|webm)$/i) ? (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <video 
                                      src={getMediaUrl(path.join(currentPath, previewFile.name))} 
                                      controls 
                                      autoPlay
                                      crossOrigin="use-credentials"
                                      className="max-w-full max-h-full rounded-lg shadow-2xl" 
                                    />
                                  </div>
                                ) : previewFile.name.match(/\.(mp3|wav|ogg)$/i) ? (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <audio 
                                      src={getMediaUrl(path.join(currentPath, previewFile.name))} 
                                      controls 
                                      autoPlay
                                      crossOrigin="use-credentials"
                                      className="w-full max-w-md" 
                                    />
                                  </div>
                                ) : isPreviewLoading ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-white/40">
                                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-sm">Loading content...</p>
                                  </div>
                                ) : previewContent ? (
                                  <SyntaxHighlighter
                                    language={previewFile.name.split('.').pop() || 'text'}
                                    style={vscDarkPlus}
                                    customStyle={{ margin: 0, background: 'transparent', fontSize: '14px' }}
                                  >
                                    {previewContent}
                                  </SyntaxHighlighter>
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-white/20">
                                    {getFileIcon(previewFile, 64)}
                                    <div className="text-center">
                                      <p className="text-lg font-medium text-white/40">No preview available</p>
                                      <p className="text-sm">This file type cannot be previewed directly.</p>
                                    </div>
                                    <button 
                                      onClick={() => handleDownload(path.join(currentPath, previewFile.name))}
                                      className="mt-4 px-6 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors flex items-center gap-2"
                                    >
                                      <Download size={18} /> Download to view
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Sidebar - Desktop */}
                    <AnimatePresence>
                      {showInfoPanel && selectedFiles.size > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="hidden md:flex w-72 bg-[#1a1a1a] border-l border-white/10 flex-col shrink-0"
                        >
                          <div className="px-6 pt-6 pb-6 flex-1 overflow-y-auto">
                            {renderFileInfoContent()}
                          </div>
                          {renderFileInfoActions()}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Right Sidebar - Mobile Bottom Sheet */}
                    <AnimatePresence>
                      {showInfoPanel && selectedFiles.size > 0 && (
                        <>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                              setSelectedFiles(new Set());
                              setShowInfoPanel(false);
                            }}
                            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm md:hidden"
                          />
                          <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed bottom-0 left-0 right-0 z-[90] bg-[#1a1a1a] border-t border-white/10 rounded-t-[32px] shadow-2xl md:hidden flex flex-col max-h-[70vh]"
                          >
                            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-3 shrink-0" />
                            <div className="px-6 pb-6 flex-1 overflow-y-auto">
                              {renderFileInfoContent()}
                            </div>
                            <div className="pb-8">
                              {renderFileInfoActions()}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
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
          <button onClick={() => { setActiveModal('files'); fetchFiles('/home'); }} className="p-2 hover:bg-white/10 rounded-xl transition-all">
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
