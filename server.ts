import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { exec } from "child_process";
import si from "systeminformation";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for real system stats
  app.get("/api/stats", async (req, res) => {
    try {
      const cpuLoad = await si.currentLoad();
      const mem = await si.mem();
      const fsStats = await si.fsSize();
      const mainDisk = fsStats[0] || { use: 0, used: 0, size: 0 };

      res.json({
        cpu: Math.round(cpuLoad.currentLoad),
        ram: Math.round((mem.active / mem.total) * 100),
        disk: Math.round(mainDisk.use),
        diskDetails: {
          used: (mainDisk.used / 1024 / 1024 / 1024).toFixed(1),
          total: (mainDisk.size / 1024 / 1024 / 1024).toFixed(1)
        },
        uptime: os.uptime(),
        hostname: os.hostname()
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch system stats" });
    }
  });

  // File Explorer API
  app.get("/api/files", async (req, res) => {
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

  // Simple Terminal API (Warning: Insecure for production without Auth)
  app.post("/api/terminal", (req, res) => {
    const { command, cwd } = req.body;
    exec(command, { cwd: cwd || os.homedir() }, (error, stdout, stderr) => {
      res.json({
        output: stdout || stderr,
        error: error ? error.message : null
      });
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
