const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Database setup
const db = new sqlite3.Database('./davclaw.db');
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)");
});

// ADB Bridge Service
const executeAdb = (command) => {
  return new Promise((resolve, reject) => {
    exec(`adb ${command}`, (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error.message);
        return;
      }
      resolve(stdout);
    });
  });
};

app.post('/api/adb/execute', async (req, res) => {
  const { command } = req.body;
  try {
    const result = await executeAdb(command);
    io.emit('log', { type: 'adb', message: `Executed: adb ${command}`, result });
    res.json({ success: true, result });
  } catch (error) {
    io.emit('log', { type: 'error', message: `Failed: adb ${command}`, error });
    res.status(500).json({ success: false, error });
  }
});

app.get('/api/adb/screenshot', async (req, res) => {
  const screenshotPath = path.join(__dirname, 'screenshot.png');
  try {
    await executeAdb(`shell screencap -p /sdcard/screenshot.png`);
    await executeAdb(`pull /sdcard/screenshot.png ${screenshotPath}`);
    const imageBuffer = fs.readFileSync(screenshotPath);
    const base64Image = imageBuffer.toString('base64');
    res.json({ success: true, image: `data:image/png;base64,${base64Image}` });
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
});

// Workspace & Filesystem
app.get('/api/fs/tree', (req, res) => {
  const projectDir = process.env.PROJECT_DIR || path.join(__dirname, '..');
  const getTree = (dir) => {
    const files = fs.readdirSync(dir);
    return files.map(file => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        if (file === 'node_modules' || file === '.git') return null;
        return { name: file, type: 'directory', children: getTree(filePath) };
      }
      return { name: file, type: 'file' };
    }).filter(Boolean);
  };
  try {
    const tree = getTree(projectDir);
    res.json({ success: true, tree });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI Integration Stubs
app.post('/api/ai/process', async (req, res) => {
  const { model, prompt, screenshot } = req.body;
  io.emit('agent_state', 'processing');
  io.emit('log', { type: 'ai', message: `AI Processing with ${model}...` });
  
  // Mocking AI response for now
  setTimeout(() => {
    const mockCommand = "shell input tap 500 500";
    io.emit('log', { type: 'ai', message: `AI Decision: ${mockCommand}` });
    io.emit('agent_state', 'idle');
    res.json({ success: true, command: mockCommand });
  }, 2000);
});

// ADB Device Polling
const pollAdbDevices = () => {
  exec('adb devices', (error, stdout, stderr) => {
    const lines = stdout.split('\n').filter(line => line.trim() !== '' && !line.startsWith('List of devices'));
    const devices = lines.map(line => line.split('\t')[0]);
    io.emit('adb_status', { connected: devices.length > 0, devices });
  });
};

setInterval(pollAdbDevices, 5000);

// WebSocket Connection
io.on('connection', (socket) => {
  console.log('Client connected');
  socket.emit('log', { type: 'system', message: 'Connected to DAVClaw Backend' });
  pollAdbDevices();
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
