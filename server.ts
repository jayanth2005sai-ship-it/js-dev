import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import os from "os";
import fs from "fs/promises";
import fsSync from "fs";
import { exec } from "child_process";
import si from "systeminformation";
import { Client } from "ssh2";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import multer from "multer";

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
const upload = multer({ storage });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());
  
  // Serve public files statically
  app.use(express.static(path.join(process.cwd(), 'public')));
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Authentication Middleware
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    let token = req.cookies.auth_token;
    
    // Also check Authorization header for Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
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
        const fsStats = await si.fsSize();
        const mainDisk = fsStats[0] || { use: 0, used: 0, size: 0 };
        diskUsagePercent = Math.round(mainDisk.use);
        diskUsedGB = (mainDisk.used / 1024 / 1024 / 1024).toFixed(1);
        diskTotalGB = (mainDisk.size / 1024 / 1024 / 1024).toFixed(1);
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
    const targetPath = (req.query.path as string) || os.homedir();
    try {
      const files = await fs.readdir(targetPath, { withFileTypes: true });
      const result = files.map(file => ({
        name: file.name,
        isDirectory: file.isDirectory(),
        size: 0, // Simplified
        modified: new Date()
      }));
      res.json({ path: targetPath, files: result });
    } catch (error) {
      res.status(500).json({ error: "Failed to read directory" });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
