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
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
interface AppIcon {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  action?: () => void;
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
}

// Path helpers for frontend
const path = {
  dirname: (p: string) => p.split('/').slice(0, -1).join('/') || '/',
  join: (...parts: string[]) => parts.join('/').replace(/\/+/g, '/')
};

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [systemStats, setSystemStats] = useState({
    cpu: 0,
    ram: 0,
    disk: 0,
    diskDetails: { used: '0', total: '0' },
    hostname: 'CasaDash'
  });

  // Modal States
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [terminalOutput, setTerminalOutput] = useState<string[]>(['Welcome to CasaDash Terminal', 'Type "help" for a list of commands.']);
  const [terminalInput, setTerminalInput] = useState('');
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
        if (response.ok) {
          const data = await response.json();
          setSystemStats(data);
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
  }, []);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalOutput]);

  const fetchFiles = async (path: string = '') => {
    try {
      const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files);
        setCurrentPath(data.path);
      }
    } catch (error) {
      console.error("Failed to fetch files:", error);
    }
  };

  const runCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const cmd = terminalInput;
    setTerminalInput('');
    setTerminalOutput(prev => [...prev, `> ${cmd}`]);

    try {
      const response = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, cwd: currentPath })
      });
      const data = await response.json();
      setTerminalOutput(prev => [...prev, data.output || data.error || 'Command executed.']);
    } catch (error) {
      setTerminalOutput(prev => [...prev, 'Error: Failed to execute command.']);
    }
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
    { id: 'settings', name: 'Settings', icon: <Settings size={32} />, color: 'bg-slate-500' },
  ];

  const stats: SystemStat[] = [
    { label: 'CPU', value: systemStats.cpu, icon: <Cpu size={18} />, unit: '%' },
    { label: 'RAM', value: systemStats.ram, icon: <Activity size={18} />, unit: '%' },
    { label: 'Disk', value: systemStats.disk, icon: <HardDrive size={18} />, unit: '%' },
  ];

  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-blue-500/30 overflow-hidden relative">
      {/* Background Wallpaper with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 scale-105 blur-sm"
        style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />

      {/* Top Navigation Bar */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-4 backdrop-blur-md bg-black/10 border-b border-white/5">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <LayoutGrid size={18} />
            </div>
            <span>{systemStats.hostname}</span>
          </div>
          
          <div className="hidden md:flex items-center gap-4 text-sm font-medium text-white/60">
            <span className="hover:text-white transition-colors cursor-pointer">Dashboard</span>
            <span className="hover:text-white transition-colors cursor-pointer">App Store</span>
            <span className="hover:text-white transition-colors cursor-pointer">Files</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <Clock size={16} className="text-blue-400" />
            <span className="text-sm font-mono tracking-wider">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <Bell size={20} />
            </button>
            <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-red-400">
              <Power size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="relative z-10 container mx-auto px-8 pt-12 pb-24 h-[calc(100vh-76px)] overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
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
                {stats.map((stat) => (
                  <motion.div 
                    key={stat.label}
                    whileHover={{ scale: 1.02 }}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/5 rounded-lg text-blue-400">
                        {stat.icon}
                      </div>
                      <div>
                        <p className="text-xs text-white/40 font-medium">{stat.label}</p>
                        <p className="text-lg font-bold">{stat.value}{stat.unit}</p>
                      </div>
                    </div>
                    <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${stat.value}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-blue-500"
                      />
                    </div>
                  </motion.div>
                ))}
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
                    animate={{ strokeDashoffset: 251.2 - (251.2 * systemStats.disk) / 100 }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                    className="text-blue-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold">{systemStats.disk}%</span>
                  <span className="text-[10px] text-white/40 uppercase">Used</span>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-white/60">{systemStats.diskDetails.used} GB of {systemStats.diskDetails.total} GB used</p>
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
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-6"
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
                    className="group flex flex-col items-center gap-4 cursor-pointer"
                  >
                    <div className={`w-20 h-20 ${app.color} rounded-3xl flex items-center justify-center shadow-2xl shadow-black/40 group-hover:shadow-blue-500/20 transition-all duration-300 relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      {app.icon}
                    </div>
                    <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                      {app.name}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {/* Add App Placeholder */}
              <motion.div
                whileHover={{ y: -8 }}
                className="group flex flex-col items-center gap-4 cursor-pointer"
              >
                <div className="w-20 h-20 bg-white/5 border-2 border-dashed border-white/10 rounded-3xl flex items-center justify-center group-hover:border-blue-500/50 group-hover:bg-blue-500/5 transition-all">
                  <LayoutGrid size={32} className="text-white/20 group-hover:text-blue-400 transition-colors" />
                </div>
                <span className="text-sm font-medium text-white/40 group-hover:text-blue-400 transition-colors">
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-12 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-5xl h-full max-h-[800px] bg-[#1a1a1a] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-3">
                  {activeModal === 'files' ? <FolderOpen className="text-blue-400" /> : <TerminalIcon className="text-emerald-400" />}
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
                {activeModal === 'files' ? (
                  <div className="h-full flex flex-col">
                    <div className="px-6 py-3 bg-black/20 flex items-center gap-2 text-sm text-white/40">
                      <button onClick={() => fetchFiles(path.dirname(currentPath))} className="hover:text-white"><ChevronLeft size={16} /></button>
                      <span className="font-mono truncate">{currentPath}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                      {files.map((file) => (
                        <div 
                          key={file.name}
                          onClick={() => file.isDirectory ? fetchFiles(path.join(currentPath, file.name)) : null}
                          className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
                        >
                          {file.isDirectory ? (
                            <FolderOpen size={48} className="text-blue-400 group-hover:scale-110 transition-transform" />
                          ) : (
                            <File size={48} className="text-white/20 group-hover:scale-110 transition-transform" />
                          )}
                          <span className="text-xs text-center truncate w-full">{file.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-full bg-black p-4 font-mono text-sm flex flex-col">
                    <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                      {terminalOutput.map((line, i) => (
                        <div key={i} className="whitespace-pre-wrap break-all">
                          {line.startsWith('>') ? (
                            <span className="text-emerald-400">{line}</span>
                          ) : (
                            <span className="text-white/80">{line}</span>
                          )}
                        </div>
                      ))}
                      <div ref={terminalEndRef} />
                    </div>
                    <form onSubmit={runCommand} className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4">
                      <span className="text-emerald-400">$</span>
                      <input 
                        type="text"
                        value={terminalInput}
                        onChange={(e) => setTerminalInput(e.target.value)}
                        autoFocus
                        className="flex-1 bg-transparent border-none focus:ring-0 outline-none"
                        placeholder="Enter command..."
                      />
                    </form>
                  </div>
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
          <button className="p-2 hover:bg-white/10 rounded-xl transition-all">
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
