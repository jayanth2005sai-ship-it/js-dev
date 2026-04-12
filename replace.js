import fs from 'fs';

const appPath = 'src/App.tsx';
let content = fs.readFileSync(appPath, 'utf8');

const startMarker = `                ) : activeModal === 'files' ? (`;
const endMarker = `                ) : (\n                  <Terminal isActive={activeModal === 'terminal'} />\n                )`;

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Markers not found');
  process.exit(1);
}

const replacement = `                ) : activeModal === 'files' ? (
                  <div className="h-full flex bg-[#1e1e1e] text-white">
                    {/* Left Sidebar */}
                    <div className="w-64 bg-[#1a1a1a] border-r border-white/10 flex flex-col shrink-0">
                      <div className="p-4">
                        <h3 className="text-xs font-semibold text-white/40 mb-3 tracking-wider">QUICK ACCESS</h3>
                        <div className="space-y-1">
                          <button onClick={() => fetchFiles('/home')} className={\`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors \${currentPath === '/home' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}\`}>
                            <Home size={18} /> Home
                          </button>
                          <button onClick={() => fetchFiles('/home/Documents')} className={\`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors \${currentPath === '/home/Documents' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}\`}>
                            <FileText size={18} /> Documents
                          </button>
                          <button onClick={() => fetchFiles('/home/Images')} className={\`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors \${currentPath === '/home/Images' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}\`}>
                            <ImageIcon size={18} /> Images
                          </button>
                          <button onClick={() => fetchFiles('/home/Downloads')} className={\`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors \${currentPath === '/home/Downloads' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}\`}>
                            <Download size={18} /> Downloads
                          </button>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="text-xs font-semibold text-white/40 mb-3 tracking-wider">STORAGE</h3>
                        <div className="space-y-1">
                          <button onClick={() => fetchFiles('/')} className={\`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors \${currentPath === '/' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}\`}>
                            <HardDrive size={18} /> /
                          </button>
                          <button onClick={() => fetchFiles('/mnt')} className={\`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors \${currentPath === '/mnt' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}\`}>
                            <HardDrive size={18} /> /mnt
                          </button>
                        </div>
                      </div>
                      <div className="mt-auto p-4 border-t border-white/10">
                         <p className="text-xs text-white/40">Disk usage</p>
                         <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                           <div className="h-full bg-blue-500" style={{ width: \`\${systemStats.disk.usagePercent}%\` }}></div>
                         </div>
                      </div>
                    </div>

                    {/* Middle Column */}
                    <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
                      {/* Top Bar */}
                      <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 shrink-0">
                        <div className="flex items-center gap-2 text-sm overflow-hidden whitespace-nowrap">
                          <button onClick={() => fetchFiles(path.dirname(currentPath))} className="text-white/40 hover:text-white shrink-0"><ChevronLeft size={16} /></button>
                          <span className="text-white/40 truncate">
                            {currentPath.split('/').map((part, i, arr) => (
                              <React.Fragment key={i}>
                                {part || (i === 0 ? 'root' : '')}
                                {i < arr.length - 1 && ' / '}
                              </React.Fragment>
                            ))}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                            <input 
                              type="text" 
                              placeholder="Search files..." 
                              value={fileSearchQuery}
                              onChange={(e) => setFileSearchQuery(e.target.value)}
                              className="bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-48 lg:w-64" 
                            />
                          </div>
                          <div className="flex items-center gap-1 border-l border-white/10 pl-3">
                            <button onClick={() => setIsCreatingFolder(true)} className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors" title="New Folder">
                              <FolderPlus size={16} />
                            </button>
                            <label className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer" title="Upload">
                              <Upload size={16} />
                              <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                            </label>
                          </div>
                        </div>
                      </div>
                      
                      {/* File Grid */}
                      <div className="flex-1 overflow-y-auto p-6 relative">
                        {fileError && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4 flex items-center justify-between text-red-400 text-sm">
                            <span>{fileError}</span>
                            <button onClick={() => setFileError(null)} className="hover:text-red-300 transition-colors"><X size={16} /></button>
                          </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 content-start">
                          {files.filter(f => f.name.toLowerCase().includes(fileSearchQuery.toLowerCase())).map((file) => {
                            const isSelected = selectedFiles.has(file.name);
                            return (
                              <div 
                                key={file.name}
                                onClick={() => {
                                  const newSelected = new Set([file.name]);
                                  setSelectedFiles(newSelected);
                                }}
                                onDoubleClick={() => {
                                  if (file.isDirectory) {
                                    fetchFiles(path.join(currentPath, file.name));
                                  } else {
                                    setPreviewFile(file);
                                  }
                                }}
                                className={\`flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition-all border \${isSelected ? 'bg-white/10 border-white/20 shadow-lg' : 'bg-transparent border-transparent hover:bg-white/5'}\`}
                              >
                                <div className="mb-3">
                                  {getFileIcon(file, 48)}
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
                                className="w-full bg-black/20 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-4"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                              />
                              <div className="flex gap-3">
                                <button 
                                  onClick={() => setIsCreatingFolder(false)}
                                  className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
                                >
                                  Cancel
                                </button>
                                <button 
                                  onClick={handleCreateFolder}
                                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
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
                                className="w-full bg-black/20 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-4"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                              />
                              <div className="flex gap-3">
                                <button 
                                  onClick={() => setRenameFile(null)}
                                  className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
                                >
                                  Cancel
                                </button>
                                <button 
                                  onClick={handleRename}
                                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
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
                                className="w-full bg-black/20 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-4"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleMove()}
                              />
                              <div className="flex gap-3">
                                <button 
                                  onClick={() => setMoveFile(null)}
                                  className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
                                >
                                  Cancel
                                </button>
                                <button 
                                  onClick={handleMove}
                                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
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
                                </div>
                                <button onClick={() => setPreviewFile(null)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors">
                                  <X size={18} />
                                </button>
                              </div>
                              <div className="flex-1 overflow-auto bg-black/40 p-4">
                                {previewContent ? (
                                  <SyntaxHighlighter
                                    language={previewFile.name.split('.').pop() || 'text'}
                                    style={vscDarkPlus}
                                    customStyle={{ margin: 0, background: 'transparent', fontSize: '14px' }}
                                  >
                                    {previewContent}
                                  </SyntaxHighlighter>
                                ) : previewFile.name.match(/\\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <img src={\`/api/files/download?path=\${encodeURIComponent(path.join(currentPath, previewFile.name))}\`} alt={previewFile.name} className="max-w-full max-h-full object-contain rounded-lg" />
                                  </div>
                                ) : previewFile.name.match(/\\.(mp4|webm)$/i) ? (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <video src={\`/api/files/download?path=\${encodeURIComponent(path.join(currentPath, previewFile.name))}\`} controls className="max-w-full max-h-full rounded-lg" />
                                  </div>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-white/40">
                                    Loading preview...
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Sidebar */}
                    <div className="w-72 bg-[#1a1a1a] border-l border-white/10 flex flex-col shrink-0">
                      <div className="p-4 flex justify-end">
                        <button onClick={() => setActiveModal(null)} className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-md transition-colors">
                          <X size={20} />
                        </button>
                      </div>
                      <div className="px-6 pb-6 flex-1 overflow-y-auto">
                        {(() => {
                          const selectedFileObj = selectedFiles.size === 1 ? files.find(f => f.name === Array.from(selectedFiles)[0]) : null;
                          if (selectedFileObj) {
                            return (
                              <>
                                <div className="flex justify-between items-start mb-6">
                                  <div className="w-16 h-16 bg-white/5 rounded-xl flex items-center justify-center">
                                    {getFileIcon(selectedFileObj, 32)}
                                  </div>
                                  <button className="text-white/40 hover:text-white"><MoreHorizontal size={20} /></button>
                                </div>
                                <h2 className="text-xl font-semibold mb-8 truncate" title={selectedFileObj.name}>{selectedFileObj.name}</h2>
                                
                                <div className="mb-8">
                                  <h3 className="text-xs font-semibold text-white/40 mb-4 tracking-wider">FILE INFO</h3>
                                  <div className="space-y-3 text-sm">
                                    <div className="flex justify-between"><span className="text-white/60">Size</span><span>{formatBytes(selectedFileObj.size)}</span></div>
                                    <div className="flex justify-between"><span className="text-white/60">Modified</span><span>{new Date(selectedFileObj.modified).toLocaleDateString()}</span></div>
                                    <div className="flex justify-between"><span className="text-white/60">Owner</span><span>root</span></div>
                                    <div className="flex justify-between"><span className="text-white/60">Perms</span><span className="font-mono">{selectedFileObj.permissions}</span></div>
                                  </div>
                                </div>

                                <div>
                                  <h3 className="text-xs font-semibold text-white/40 mb-4 tracking-wider">METADATA DB</h3>
                                  <p className="text-sm text-white/60">No tags yet</p>
                                  <p className="text-sm text-white/40 mt-2">--</p>
                                </div>
                              </>
                            );
                          } else if (selectedFiles.size > 1) {
                            return (
                              <div className="h-full flex flex-col items-center justify-center text-white/40">
                                <ClipboardList size={48} className="mb-4 opacity-20" />
                                <p>{selectedFiles.size} files selected</p>
                              </div>
                            );
                          } else {
                            return (
                              <div className="h-full flex flex-col items-center justify-center text-white/40">
                                <Folder size={48} className="mb-4 opacity-20" />
                                <p>Select a file</p>
                              </div>
                            );
                          }
                        })()}
                      </div>
                      
                      {selectedFiles.size > 0 && (
                        <div className="p-4 border-t border-white/10 space-y-2">
                          {selectedFiles.size === 1 && (() => {
                            const selectedFileObj = files.find(f => f.name === Array.from(selectedFiles)[0]);
                            if (!selectedFileObj) return null;
                            return (
                              <>
                                <button onClick={() => { setRenameFile(selectedFileObj); setNewFileName(selectedFileObj.name); }} className="w-full py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-colors flex items-center justify-center gap-2 text-sm font-medium">
                                  Rename <ArrowUpRight size={16} className="text-white/40" />
                                </button>
                                <button onClick={() => { setMoveFile(selectedFileObj); setMoveDestination(currentPath); }} className="w-full py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-colors flex items-center justify-center gap-2 text-sm font-medium">
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
                      )}
                    </div>
                  </div>
\n`;

const newContent = content.slice(0, startIndex) + replacement + content.slice(endIndex);
fs.writeFileSync(appPath, newContent);
console.log('Done');
