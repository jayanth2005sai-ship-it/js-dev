import React from 'react';
import { 
  Folder, FileText, Archive, FilePenLine, Laptop, Code, 
  Database as DatabaseIcon, Settings as SettingsIcon, 
  FileImage, FileVideo, FileAudio, File
} from 'lucide-react';

export const getFileIcon = (file: { name: string, isDirectory: boolean }, size = 32) => {
  if (file.isDirectory) return <Folder size={size} className="text-yellow-500 fill-yellow-500/20" />;
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return <FileText size={size} className="text-red-400" />;
    case 'tar':
    case 'gz':
    case 'zip': return <Archive size={size} className="text-purple-400" />;
    case 'md': return <FilePenLine size={size} className="text-blue-400" />;
    case 'go': return <Laptop size={size} className="text-cyan-400" />;
    case 'py': return <Code size={size} className="text-green-400" />;
    case 'sql': return <DatabaseIcon size={size} className="text-indigo-400" />;
    case 'yaml':
    case 'yml': return <SettingsIcon size={size} className="text-slate-400" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
    case 'tiff':
    case 'ico': return <FileImage size={size} className="text-orange-400" />;
    case 'mp4':
    case 'mkv':
    case 'webm': return <FileVideo size={size} className="text-pink-400" />;
    case 'mp3':
    case 'wav':
    case 'ogg': return <FileAudio size={size} className="text-emerald-400" />;
    default: return <File size={size} className="text-white/60" />;
  }
};
