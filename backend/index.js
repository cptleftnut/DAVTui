const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const analyticsRouter = require('./analytics');
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
app.use('/api/analytics', analyticsRouter);

// ============================================================================
// DATABASE SETUP
// ============================================================================

const db = new sqlite3.Database('./davclaw.db');

const initializeDatabase = () => {
  db.serialize(() => {
    // Logs table - stores all system, ADB, AI, and error logs
    db.run(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        result TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        session_id TEXT
      )
    `);

    // ADB Commands history - tracks all executed ADB commands
    db.run(`
      CREATE TABLE IF NOT EXISTS adb_commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        command TEXT NOT NULL,
        result TEXT,
        error TEXT,
        execution_time INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        device_id TEXT
      )
    `);

    // Device State - tracks connected devices and their status
    db.run(`
      CREATE TABLE IF NOT EXISTS device_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT UNIQUE,
        model TEXT,
        android_version TEXT,
        battery_level INTEGER,
        screen_state TEXT,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_connected BOOLEAN DEFAULT 1
      )
    `);

    // AI Interactions - stores AI analysis and predictions
    db.run(`
      CREATE TABLE IF NOT EXISTS ai_interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model TEXT NOT NULL,
        prompt TEXT NOT NULL,
        screenshot_path TEXT,
        predicted_command TEXT,
        confidence REAL,
        execution_result TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Command History - tracks user-issued commands
    db.run(`
      CREATE TABLE IF NOT EXISTS command_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_command TEXT NOT NULL,
        ai_model TEXT,
        predicted_action TEXT,
        user_confirmed BOOLEAN,
        execution_result TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // VLA Loop Sessions - tracks VLA (Visual Language Agent) sessions
    db.run(`
      CREATE TABLE IF NOT EXISTS vla_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE,
        model TEXT,
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        commands_executed INTEGER DEFAULT 0,
        success_rate REAL
      )
    `);

    console.log('Database initialized successfully');
  });
};

initializeDatabase();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const logEvent = (type, message, result = null, sessionId = null) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO logs (type, message, result, session_id) VALUES (?, ?, ?, ?)',
      [type, message, result, sessionId],
      function(err) {
        if (err) reject(err);
        else {
          io.emit('log', { 
            id: this.lastID,
            type, 
            message, 
            result,
            timestamp: new Date().toLocaleTimeString() 
          });
          resolve(this.lastID);
        }
      }
    );
  });
};

const executeAdbCommand = (command, deviceId = null) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const fullCommand = deviceId ? `adb -s ${deviceId} ${command}` : `adb ${command}`;
    
    exec(fullCommand, { timeout: 30000 }, (error, stdout, stderr) => {
      const executionTime = Date.now() - startTime;
      
      if (error) {
        db.run(
          'INSERT INTO adb_commands (command, error, execution_time, device_id) VALUES (?, ?, ?, ?)',
          [command, stderr || error.message, executionTime, deviceId]
        );
        reject({ error: stderr || error.message, executionTime });
      } else {
        db.run(
          'INSERT INTO adb_commands (command, result, execution_time, device_id) VALUES (?, ?, ?, ?)',
          [command, stdout, executionTime, deviceId]
        );
        resolve({ result: stdout, executionTime });
      }
    });
  });
};

// ============================================================================
// ADB BRIDGE SERVICE
// ============================================================================

app.post('/api/adb/execute', async (req, res) => {
  const { command, deviceId } = req.body;
  
  if (!command) {
    return res.status(400).json({ success: false, error: 'Command is required' });
  }

  try {
    const { result, executionTime } = await executeAdbCommand(command, deviceId);
    await logEvent('adb', `Executed: adb ${command}`, result);
    
    res.json({ 
      success: true, 
      result, 
      executionTime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await logEvent('error', `Failed: adb ${command}`, error.error);
    res.status(500).json({ 
      success: false, 
      error: error.error,
      executionTime: error.executionTime
    });
  }
});

app.get('/api/adb/devices', async (req, res) => {
  try {
    const { result } = await executeAdbCommand('devices');
    const lines = result.split('\n').filter(line => line.trim() && !line.startsWith('List'));
    const devices = lines.map(line => {
      const [id, status] = line.split('\t');
      return { id: id.trim(), status: status.trim() };
    });
    
    res.json({ success: true, devices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.error });
  }
});

app.get('/api/adb/screenshot', async (req, res) => {
  const { deviceId } = req.query;
  const screenshotPath = path.join(__dirname, `screenshot${deviceId ? '_' + deviceId : ''}.png`);
  
  try {
    const shellCmd = 'shell screencap -p /sdcard/screenshot.png';
    const pullCmd = `pull /sdcard/screenshot.png ${screenshotPath}`;
    
    await executeAdbCommand(shellCmd, deviceId);
    await executeAdbCommand(pullCmd, deviceId);
    
    const imageBuffer = fs.readFileSync(screenshotPath);
    const base64Image = imageBuffer.toString('base64');
    
    await logEvent('adb', `Screenshot captured from device ${deviceId || 'default'}`);
    
    res.json({ 
      success: true, 
      image: `data:image/png;base64,${base64Image}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await logEvent('error', `Screenshot failed: ${error.error}`);
    res.status(500).json({ success: false, error: error.error });
  }
});

app.get('/api/adb/device-info', async (req, res) => {
  const { deviceId } = req.query;
  
  try {
    const modelResult = await executeAdbCommand('shell getprop ro.product.model', deviceId);
    const versionResult = await executeAdbCommand('shell getprop ro.build.version.release', deviceId);
    const batteryResult = await executeAdbCommand('shell dumpsys battery', deviceId);
    
    const batteryMatch = batteryResult.result.match(/level: (\d+)/);
    const batteryLevel = batteryMatch ? parseInt(batteryMatch[1]) : null;
    
    const deviceInfo = {
      model: modelResult.result.trim(),
      androidVersion: versionResult.result.trim(),
      batteryLevel,
      timestamp: new Date().toISOString()
    };
    
    // Update device state in database
    db.run(
      `INSERT OR REPLACE INTO device_state (device_id, model, android_version, battery_level, is_connected)
       VALUES (?, ?, ?, ?, 1)`,
      [deviceId || 'default', deviceInfo.model, deviceInfo.androidVersion, deviceInfo.batteryLevel]
    );
    
    res.json({ success: true, ...deviceInfo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.error });
  }
});

// ============================================================================
// AI INTEGRATION PROCEDURES
// ============================================================================

const callGeminiAPI = async (prompt, imageBase64) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [
            { text: prompt },
            imageBase64 ? {
              inlineData: {
                mimeType: "image/png",
                data: imageBase64
              }
            } : null
          ].filter(Boolean)
        }]
      }
    );
    
    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    throw new Error(`Gemini API error: ${error.message}`);
  }
};

const callClaudeAPI = async (prompt, imageBase64) => {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error('CLAUDE_API_KEY not configured');
  
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            imageBase64 ? {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: imageBase64
              }
            } : null
          ].filter(Boolean)
        }]
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );
    
    return response.data.content[0].text;
  } catch (error) {
    throw new Error(`Claude API error: ${error.message}`);
  }
};

const callOllamaAPI = async (prompt, imageBase64) => {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  
  try {
    const response = await axios.post(
      `${baseUrl}/api/generate`,
      {
        model: "llama2",
        prompt: prompt,
        stream: false
      }
    );
    
    return response.data.response;
  } catch (error) {
    throw new Error(`Ollama API error: ${error.message}`);
  }
};

app.post('/api/ai/process', async (req, res) => {
  const { model, prompt, screenshot, sessionId, deviceId } = req.body;
  
  if (!model || !prompt) {
    return res.status(400).json({ success: false, error: 'Model and prompt are required' });
  }

  const newSessionId = sessionId || `session_${Date.now()}`;
  
  try {
    io.emit('agent_state', 'processing');
    await logEvent('ai', `Processing with ${model}...`, null, newSessionId);
    
    let aiResponse;
    const imageBase64 = screenshot ? screenshot.replace('data:image/png;base64,', '') : null;
    
    switch (model.toLowerCase()) {
      case 'gemini':
        aiResponse = await callGeminiAPI(prompt, imageBase64);
        break;
      case 'claude':
        aiResponse = await callClaudeAPI(prompt, imageBase64);
        break;
      case 'ollama':
        aiResponse = await callOllamaAPI(prompt, imageBase64);
        break;
      default:
        // Mock response for testing
        aiResponse = `[MOCK] Predicted action: shell input tap 500 500`;
    }
    
    // Parse ADB command from AI response
    const commandMatch = aiResponse.match(/adb\s+(.+?)(?:\n|$)/i) || 
                         aiResponse.match(/shell\s+(.+?)(?:\n|$)/i);
    const predictedCommand = commandMatch ? commandMatch[1] : null;
    const confidence = Math.random() * 0.5 + 0.5; // Mock confidence
    
    // Store AI interaction
    db.run(
      `INSERT INTO ai_interactions (model, prompt, screenshot_path, predicted_command, confidence)
       VALUES (?, ?, ?, ?, ?)`,
      [model, prompt, screenshot ? 'screenshot.png' : null, predictedCommand, confidence]
    );
    
    await logEvent('ai', `AI Decision: ${aiResponse}`, null, newSessionId);
    io.emit('agent_state', 'idle');
    
    res.json({ 
      success: true, 
      response: aiResponse,
      predictedCommand,
      confidence,
      sessionId: newSessionId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await logEvent('error', `AI Processing failed: ${error.message}`, null, newSessionId);
    io.emit('agent_state', 'idle');
    res.status(500).json({ 
      success: false, 
      error: error.message,
      sessionId: newSessionId
    });
  }
});

// ============================================================================
// FILESYSTEM API
// ============================================================================

app.get('/api/fs/tree', (req, res) => {
  const projectDir = process.env.PROJECT_DIR || path.join(__dirname, '..');
  
  const getTree = (dir, depth = 0) => {
    if (depth > 5) return []; // Limit recursion depth
    
    try {
      const files = fs.readdirSync(dir);
      return files
        .filter(file => !['node_modules', '.git', '.env', 'davclaw.db'].includes(file))
        .map(file => {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.isDirectory()) {
            return {
              name: file,
              type: 'directory',
              children: getTree(filePath, depth + 1)
            };
          }
          
          return {
            name: file,
            type: 'file',
            size: stats.size
          };
        })
        .filter(Boolean);
    } catch (error) {
      return [];
    }
  };
  
  try {
    const tree = getTree(projectDir);
    res.json({ success: true, tree });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/fs/read', (req, res) => {
  const { filePath } = req.query;
  
  if (!filePath) {
    return res.status(400).json({ success: false, error: 'filePath is required' });
  }
  
  try {
    const fullPath = path.join(process.env.PROJECT_DIR || '/home/ubuntu/DAVTui', filePath);
    
    // Security: prevent directory traversal
    if (!fullPath.startsWith(process.env.PROJECT_DIR || '/home/ubuntu/DAVTui')) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    res.json({ success: true, content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// LOGGING & HISTORY ENDPOINTS
// ============================================================================

app.get('/api/logs', (req, res) => {
  const { limit = 100, type = null } = req.query;
  
  let query = 'SELECT * FROM logs';
  const params = [];
  
  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, logs: rows.reverse() });
  });
});

app.get('/api/adb/command-history', (req, res) => {
  const { limit = 50 } = req.query;
  
  db.all(
    'SELECT * FROM adb_commands ORDER BY timestamp DESC LIMIT ?',
    [parseInt(limit)],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, history: rows.reverse() });
    }
  );
});

app.get('/api/device-state', (req, res) => {
  db.all(
    'SELECT * FROM device_state WHERE is_connected = 1',
    (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, devices: rows });
    }
  );
});

// ============================================================================
// WEBSOCKET & POLLING
// ============================================================================

const pollAdbDevices = () => {
  exec('adb devices', (error, stdout, stderr) => {
    const lines = stdout.split('\n').filter(line => line.trim() && !line.startsWith('List'));
    const devices = lines.map(line => {
      const [id, status] = line.split('\t');
      return { id: id.trim(), status: status.trim() };
    });
    
    io.emit('adb_status', { 
      connected: devices.length > 0, 
      devices,
      timestamp: new Date().toISOString()
    });
  });
};

// Poll every 5 seconds
setInterval(pollAdbDevices, 5000);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  logEvent('system', `Client connected: ${socket.id}`);
  socket.emit('log', { 
    type: 'system', 
    message: 'Connected to DAVClaw Backend',
    timestamp: new Date().toLocaleTimeString()
  });
  
  // Initial device poll
  pollAdbDevices();
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    logEvent('system', `Client disconnected: ${socket.id}`);
  });
});

// ============================================================================
// ANALYTICS ROUTES
// ============================================================================

app.use('/api/analytics', analyticsRouter);

// ============================================================================
// ERROR HANDLING & SERVER START
// ============================================================================

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logEvent('error', `Unhandled rejection: ${reason}`);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`DAVClaw Backend running on port ${PORT}`);
  logEvent('system', `Server started on port ${PORT}`);
});

module.exports = { app, server, io, db };
