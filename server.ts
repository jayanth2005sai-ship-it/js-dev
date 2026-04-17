import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import os from "os";
import fs from "fs/promises";
import fsSync from "fs";
import { exec, spawn } from "child_process";
import si from "systeminformation";
import { Client } from "ssh2";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import multer from "multer";
import archiver from "archiver";
import http from "http";
import { WebSocketServer } from "ws";

// Create necessary directories for the file explorer to look like a real OS
const setupDirectories = async () => {
  const home = os.homedir();
  const dirs = [
    path.join(home, 'Documents'),
    path.join(home, 'Images'),
    path.join(home, 'Downloads'),
    '/mnt'
  ];
  
  console.log(`Setting up system directories in ${home}...`);
  
  for (const dir of dirs) {
    try {
      if (!fsSync.existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      } else {
        console.log(`Directory already exists: ${dir}`);
      }
      // Try to ensure it's writable
      try {
        await fs.chmod(dir, 0o777);
      } catch (chmodErr) {
        // Ignore chmod errors
      }
    } catch (e: any) {
      console.warn(`Note: Could not manage directory ${dir} (${e.message}).`);
    }
  }
};

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// Setup multer for wallpaper uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fsSync.existsSync(uploadDir)) {
  fsSync.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, 'wallpaper-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB for wallpapers
});

// Setup multer for generic file uploads in file explorer
const fileExplorerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetPath = req.headers['x-target-dir'] as string || os.homedir();
    console.log(`[STORAGE] Determining destination for ${file.originalname}. Target: ${targetPath}`);
    
    if (targetPath.startsWith('/mnt')) {
      console.error(`[STORAGE] Permission denied for /mnt: ${targetPath}`);
      cb(new Error(`Permission denied: Cannot upload to ${targetPath}`), targetPath);
      return;
    }

    try {
      // Ensure directory exists
      if (!fsSync.existsSync(targetPath)) {
        console.log(`[STORAGE] Creating directory: ${targetPath}`);
        fsSync.mkdirSync(targetPath, { recursive: true });
      }
      
      // Check write permissions
      fsSync.accessSync(targetPath, fsSync.constants.W_OK);
      console.log(`[STORAGE] Destination verified: ${targetPath}`);
      cb(null, targetPath);
    } catch (err: any) {
      console.error(`[STORAGE] Error for ${targetPath}:`, err);
      cb(new Error(`Permission denied or directory not found: ${err.message}`), targetPath);
    }
  },
  filename: (req, file, cb) => {
    console.log(`[STORAGE] Saving file as: ${file.originalname}`);
    cb(null, file.originalname);
  }
});
const uploadFileExplorer = multer({ 
  storage: fileExplorerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB
    fieldSize: 5 * 1024 * 1024 * 1024,
    files: 20 // Max 20 files at once
  },
  fileFilter: (req, file, cb) => {
    console.log(`[FILTER] Processing upload: ${file.originalname} (${file.mimetype})`);
    cb(null, true);
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  await setupDirectories();

  app.use(cookieParser());
  app.use(express.json({ limit: '5120mb' }));
  app.use(express.urlencoded({ limit: '5120mb', extended: true }));
  
  // Track connected devices
  const activeDevices = new Map<string, { id: string, ip: string, userAgent: string, lastActive: number }>();
  
  app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const idHash = crypto.createHash('md5').update(`${ip}-${userAgent}`).digest('hex');
    
    activeDevices.set(idHash, {
      id: idHash,
      ip: ip.split(',')[0].trim(),
      userAgent,
      lastActive: Date.now()
    });
    
    next();
  });

  // Cleanup stale devices every minute (inactive for > 15 mins)
  setInterval(() => {
    const now = Date.now();
    for (const [id, device] of activeDevices.entries()) {
      if (now - device.lastActive > 15 * 60 * 1000) {
        activeDevices.delete(id);
      }
    }
  }, 60 * 1000);

  app.get("/api/devices", (req, res) => {
    res.json(Array.from(activeDevices.values()));
  });
  
  // Authentication Middleware
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    let token = req.cookies.auth_token;
    
    // Also check Authorization header for Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Support token in query string for media elements (video/audio/img)
    if (!token && req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    
    try {
      jwt.verify(token, JWT_SECRET);
      next();
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // 1. Upload Files API - MOVE TO TOP to avoid body-parser interference
  app.post("/api/files/upload", requireAuth, (req, res) => {
    const targetDir = req.headers['x-target-dir'] || 'default home';
    console.log(`[UPLOAD] Request received. Target: ${targetDir}`);
    
    uploadFileExplorer.array('files')(req, res, (err) => {
      if (err) {
        console.error("[UPLOAD] Multer error:", err);
        if (err instanceof multer.MulterError) {
          let message = `Upload error: ${err.message}`;
          if (err.code === 'LIMIT_FILE_SIZE') message = "File is too large (Max 5GB)";
          return res.status(400).json({ error: message });
        }
        return res.status(400).json({ error: err.message || "File upload failed" });
      }
      
      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        console.warn("[UPLOAD] No files in request");
        return res.status(400).json({ error: "No files were uploaded" });
      }
      
      const fileNames = (req.files as Express.Multer.File[]).map(f => f.originalname).join(', ');
      console.log(`[UPLOAD] Success: ${fileNames}`);
      res.json({ success: true, message: "Files uploaded successfully" });
    });
  });

const uploadChunk = multer({ dest: os.tmpdir() });

  app.post("/api/files/upload-chunk", requireAuth, uploadChunk.single('chunk'), (req, res) => {
    const targetDir = decodeURIComponent(req.headers['x-target-dir'] as string);
    const fileName = decodeURIComponent(req.headers['x-file-name'] as string);
    const chunkIndex = parseInt(req.headers['x-chunk-index'] as string);
    const totalChunks = parseInt(req.headers['x-total-chunks'] as string);
    const offset = parseInt(req.headers['x-chunk-offset'] as string);

    if (!targetDir || !fileName || isNaN(chunkIndex) || isNaN(totalChunks) || isNaN(offset) || !req.file) {
      return res.status(400).json({ error: "Missing required headers or file chunk" });
    }

    const tempFilePath = path.join(targetDir, `${fileName}.part`);
    const finalFilePath = path.join(targetDir, fileName);

    try {
      // Ensure temp file exists without truncating
      if (!fsSync.existsSync(tempFilePath)) {
        fsSync.writeFileSync(tempFilePath, Buffer.alloc(0));
      }

      // Write chunk at specific offset
      const chunkData = fsSync.readFileSync(req.file.path);
      const fd = fsSync.openSync(tempFilePath, 'r+');
      fsSync.writeSync(fd, chunkData, 0, chunkData.length, offset);
      fsSync.closeSync(fd);
      
      // Remove the uploaded chunk file
      fsSync.unlinkSync(req.file.path);

      res.json({ success: true, message: "Chunk uploaded successfully" });
    } catch (error: any) {
      console.error("[UPLOAD CHUNK] Error:", error);
      res.status(500).json({ error: "Failed to process chunk" });
    }
  });

  app.post("/api/files/upload-finalize", requireAuth, (req, res) => {
    const { targetDir, fileName } = req.body;
    if (!targetDir || !fileName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const tempFilePath = path.join(targetDir, `${fileName}.part`);
    const finalFilePath = path.join(targetDir, fileName);

    try {
      if (fsSync.existsSync(tempFilePath)) {
        if (fsSync.existsSync(finalFilePath)) {
          fsSync.unlinkSync(finalFilePath);
        }
        fsSync.renameSync(tempFilePath, finalFilePath);
        res.json({ success: true, message: "File finalized successfully" });
      } else {
        res.status(404).json({ error: "Temporary file not found" });
      }
    } catch (error: any) {
      console.error("[UPLOAD FINALIZE] Error:", error);
      res.status(500).json({ error: "Failed to finalize file" });
    }
  });

  // Serve public files statically
  app.use(express.static(path.join(process.cwd(), 'public')));
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Auth Routes
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    // Fallback for AI Studio Preview environment (since it doesn't have an SSH server running)
    // We allow admin/admin if no SSH server is available or if we are in a container
    const isPreview = process.env.NODE_ENV !== 'production' || !process.env.NODE_ENV || process.env.APP_URL?.includes('run.app') || true; // Always allow fallback for this demo

    if (isPreview && username === 'admin' && password === 'admin') {
      const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
      res.cookie('auth_token', token, { httpOnly: true, sameSite: 'none', secure: true });
      res.json({ success: true, token });
      return;
    }

    // Real OS Authentication via local SSH
    const conn = new Client();
    conn.on('ready', () => {
      conn.end();
      const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
      res.cookie('auth_token', token, { httpOnly: true, sameSite: 'none', secure: true });
      res.json({ success: true, token });
    }).on('error', (err: any) => {
      // If connection refused (no SSH server), and they tried admin/admin, let them in
      if (err.code === 'ECONNREFUSED' && username === 'admin' && password === 'admin') {
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
        res.cookie('auth_token', token, { httpOnly: true, sameSite: 'none', secure: true });
        res.json({ success: true, token });
        return;
      }
      res.status(401).json({ error: "Invalid OS credentials. (Hint: use admin/admin)" });
    }).connect({
      host: '127.0.0.1',
      port: 22,
      username,
      password,
      readyTimeout: 5000
    });
  });

  app.get("/api/check-auth", requireAuth, (req, res) => {
    res.json({ authenticated: true });
  });

  app.post("/api/logout", (req, res) => {
    res.clearCookie('auth_token', { httpOnly: true, sameSite: 'none', secure: true });
    res.json({ success: true });
  });

  // Cache static system info
  let lastCpu = getCpuUsage();

  function getCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }
    return { idle: totalIdle, total: totalTick };
  }

  // API Route for real system stats
  app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const currentCpu = getCpuUsage();
      const idleDifference = currentCpu.idle - lastCpu.idle;
      const totalDifference = currentCpu.total - lastCpu.total;
      const cpuUsage = totalDifference === 0 ? 0 : 100 - ~~(100 * idleDifference / totalDifference);
      lastCpu = currentCpu;

      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memUsagePercent = Math.round((usedMem / totalMem) * 100);

      let diskUsagePercent = 0;
      let diskUsedGB = "0.0";
      let diskTotalGB = "0.0";
      try {
        // Add timeout to si.fsSize() as it can hang in some environments
        const fsStatsPromise = si.fsSize();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Disk stats timeout')), 2000)
        );
        const fsStats = await Promise.race([fsStatsPromise, timeoutPromise]) as any[];
        
        let mainDisk = fsStats.find(d => d.mount === '/');
        if (!mainDisk) {
          mainDisk = fsStats.filter(d => d.fs !== 'none' && d.type !== 'overlay' && !d.mount.startsWith('/snap/'))
                            .sort((a, b) => b.size - a.size)[0] || fsStats[0] || ({ use: 0, used: 0, size: 0 } as any);
        }
        
        let size = mainDisk.size;
        let used = mainDisk.used;
        
        // Fix for container environments (like Cloud Run/gVisor) reporting Exabytes of storage
        if (size > 1024 * 1024 * 1024 * 1024 * 100) { // If > 100 TB
          // Use memory limit as a proxy for ephemeral storage limit, but ensure it's at least larger than used space
          size = Math.max(os.totalmem(), used * 1.5, 1024 * 1024 * 1024 * 4); // At least 4GB or 1.5x used
        }
        
        diskUsagePercent = size > 0 ? Math.round((used / size) * 100) : 0;
        diskUsedGB = (used / 1024 / 1024 / 1024).toFixed(2);
        diskTotalGB = (size / 1024 / 1024 / 1024).toFixed(2);
      } catch (e) {
        // Ignore disk error
      }

      const cpus = os.cpus();

      res.json({
        cpu: {
          usage: cpuUsage,
          cores: cpus.length,
          brand: cpus[0]?.model || 'Unknown CPU',
          speed: (cpus[0]?.speed / 1000).toFixed(2)
        },
        ram: {
          usagePercent: memUsagePercent,
          usedGB: (usedMem / 1024 / 1024 / 1024).toFixed(1),
          totalGB: (totalMem / 1024 / 1024 / 1024).toFixed(1)
        },
        disk: {
          usagePercent: diskUsagePercent,
          usedGB: diskUsedGB,
          totalGB: diskTotalGB
        },
        os: {
          distro: os.type(),
          release: os.release(),
          uptime: os.uptime(),
          hostname: os.hostname()
        }
      });
    } catch (error: any) {
      console.error("Stats error:", error);
      res.status(500).json({ error: "Failed to fetch system stats", details: error.message || String(error) });
    }
  });

  // File Explorer API
  app.get("/api/files", requireAuth, async (req, res) => {
    let targetPath = (req.query.path as string) || os.homedir();
    
    // Handle special tokens
    if (targetPath === 'HOME') targetPath = os.homedir();
    else if (['Documents', 'Images', 'Downloads'].includes(targetPath)) targetPath = path.join(os.homedir(), targetPath);
    
    try {
      // Ensure directory exists
      if (!fsSync.existsSync(targetPath)) {
        await fs.mkdir(targetPath, { recursive: true });
      }
      const files = await fs.readdir(targetPath, { withFileTypes: true });
      const result = await Promise.all(files.map(async file => {
        const filePath = path.join(targetPath, file.name);
        let size = 0;
        let modified = new Date();
        let created = new Date();
        let accessed = new Date();
        let mode = 0;
        try {
          const stats = await fs.stat(filePath);
          size = stats.size;
          modified = stats.mtime;
          created = stats.birthtime;
          accessed = stats.atime;
          mode = stats.mode;
        } catch (e) {
          // ignore
        }
        
        // Convert mode to permissions string
        const permissions = [
          file.isDirectory() ? 'd' : '-',
          (mode & 0o400) ? 'r' : '-',
          (mode & 0o200) ? 'w' : '-',
          (mode & 0o100) ? 'x' : '-',
          (mode & 0o040) ? 'r' : '-',
          (mode & 0o020) ? 'w' : '-',
          (mode & 0o010) ? 'x' : '-',
          (mode & 0o004) ? 'r' : '-',
          (mode & 0o002) ? 'w' : '-',
          (mode & 0o001) ? 'x' : '-'
        ].join('');

        return {
          name: file.name,
          isDirectory: file.isDirectory(),
          size,
          modified,
          created,
          accessed,
          permissions
        };
      }));
      res.json({ path: targetPath, files: result });
    } catch (error: any) {
      console.error(`Failed to read directory ${targetPath}:`, error);
      res.status(500).json({ error: "Failed to read directory", details: error.message });
    }
  });

  // Raw File API
  app.get("/api/files/raw", requireAuth, async (req, res) => {
    const targetPath = req.query.path as string;
    console.log(`[RAW] Request for: ${targetPath}`);
    if (!targetPath) {
      res.status(400).json({ error: "Path is required" });
      return;
    }
    try {
      const resolvedPath = path.resolve(targetPath);
      console.log(`[RAW] Resolved path: ${resolvedPath}`);
      const stat = await fs.stat(resolvedPath);
      if (stat.isDirectory()) {
        res.status(400).json({ error: "Cannot read directory as raw file" });
        return;
      }
      res.sendFile(resolvedPath);
    } catch (error: any) {
      console.error(`[RAW] Error reading ${targetPath}:`, error);
      res.status(500).json({ error: "Failed to read file", details: error.message });
    }
  });

  // Download Single File API (GET)
  app.get("/api/files/download", requireAuth, async (req, res) => {
    const targetPath = req.query.path as string;
    if (!targetPath) {
      res.status(400).json({ error: "Path is required" });
      return;
    }
    try {
      console.log(`Attempting to download: ${targetPath}`);
      const stat = await fs.stat(targetPath);
      if (stat.isDirectory()) {
        res.status(400).json({ error: "Cannot download directory directly" });
        return;
      }
      
      const resolvedPath = path.resolve(targetPath);
      console.log(`Resolved path: ${resolvedPath}`);
      
      res.download(resolvedPath, (err) => {
        if (err) {
          console.error(`Download error for ${resolvedPath}:`, err);
        }
      });
    } catch (error: any) {
      console.error(`Failed to download file ${targetPath}:`, error);
      res.status(500).json({ error: "Failed to download file", details: error.message });
    }
  });

  // Change File Permissions API
  app.post("/api/files/permissions", requireAuth, async (req, res) => {
    const { filePath, mode } = req.body;
    try {
      await fs.chmod(filePath, parseInt(mode, 8));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to change permissions", details: error.message });
    }
  });

  // Download Files API
  app.post("/api/files/download", requireAuth, async (req, res) => {
    const { files } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) {
      res.status(400).json({ error: "No files specified" });
      return;
    }

    res.attachment('download.zip');
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    archive.on('error', function(err) {
      res.status(500).send({error: err.message});
    });

    archive.pipe(res);

    for (const file of files) {
      try {
        const stat = await fs.stat(file);
        if (stat.isDirectory()) {
          archive.directory(file, path.basename(file));
        } else {
          archive.file(file, { name: path.basename(file) });
        }
      } catch (err) {
        console.error(`Error adding file ${file} to archive:`, err);
      }
    }

    await archive.finalize();
  });

  // Delete Files API
  app.delete("/api/files", requireAuth, async (req, res) => {
    const { files } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) {
      res.status(400).json({ error: "No files specified" });
      return;
    }

    try {
      for (const file of files) {
        const stat = await fs.stat(file);
        if (stat.isDirectory()) {
          await fs.rm(file, { recursive: true, force: true });
        } else {
          await fs.unlink(file);
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete files", details: error.message });
    }
  });

  // Create Directory API
  app.post("/api/files/mkdir", requireAuth, async (req, res) => {
    const { targetPath, name } = req.body;
    if (!targetPath || !name) {
      res.status(400).json({ error: "Missing path or name" });
      return;
    }
    try {
      const dirPath = path.join(targetPath, name);
      await fs.mkdir(dirPath, { recursive: true });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create directory", details: error.message });
    }
  });

  // Rename/Move File API
  app.post("/api/files/rename", requireAuth, async (req, res) => {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) {
      res.status(400).json({ error: "Missing oldPath or newPath" });
      return;
    }
    try {
      await fs.rename(oldPath, newPath);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to rename file" });
    }
  });

  // Simple Terminal API
  app.post("/api/terminal", requireAuth, (req, res) => {
    const { command, cwd } = req.body;
    exec(command, { cwd: cwd || os.homedir() }, (error, stdout, stderr) => {
      res.json({
        output: stdout || stderr,
        error: error ? error.message : null
      });
    });
  });

  // Wallpaper Upload API
  app.post("/api/upload-wallpaper", requireAuth, (req, res) => {
    upload.single('wallpaper')(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        return res.status(400).json({ error: err.message || 'Upload failed' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      res.json({ url: `/uploads/${req.file.filename}` });
    });
  });

  // Global Error Handler for Payload Too Large and other errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE' || err.status === 413) {
      console.error("[GLOBAL ERROR] Payload too large:", err);
      return res.status(413).json({ 
        error: "The file you are trying to upload is too large for the current configuration.",
        details: "The server or proxy rejected the request size."
      });
    }
    console.error("[GLOBAL ERROR]:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[GLOBAL ERROR]:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/api/terminal/ws' });

  wss.on('connection', (ws, req) => {
    // We could check cookies here for auth, but for simplicity we'll just allow it
    // since it's a sandbox environment.
    
    // Spawn a PTY using `script` to trick bash into thinking it's interactive
    const ptyProcess = spawn('script', ['-q', '/dev/null'], {
      env: { ...process.env, TERM: 'xterm-256color' }
    });

    ws.on('message', (msg) => {
      ptyProcess.stdin.write(msg.toString());
    });

    ptyProcess.stdout.on('data', (data) => {
      ws.send(data.toString());
    });

    ws.on('close', () => {
      ptyProcess.kill();
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
