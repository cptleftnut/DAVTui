import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { 
  Terminal, 
  Cpu, 
  Smartphone, 
  Activity, 
  Send,
  ChevronRight,
  Zap,
  Check,
  X,
  AlertCircle,
  History,
  Settings,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LogEntry {
  id?: number;
  type: 'system' | 'adb' | 'ai' | 'error';
  message: string;
  result?: string;
  timestamp: string;
}

interface AIResponse {
  response: string;
  predictedCommand?: string;
  confidence?: number;
  sessionId: string;
}

interface DeviceInfo {
  model: string;
  androidVersion: string;
  batteryLevel: number;
  timestamp: string;
}

interface CommandConfirmation {
  sessionId: string;
  predictedCommand: string;
  confidence: number;
  aiResponse: string;
}

const App: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [adbStatus, setAdbStatus] = useState<{ connected: boolean; devices: any[] }>({ 
    connected: false, 
    devices: [] 
  });
  const [agentState, setAgentState] = useState<'idle' | 'processing' | 'confirming'>('idle');
  const [selectedModel, setSelectedModel] = useState('Gemini');
  const [cliInput, setCliInput] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [commandConfirmation, setCommandConfirmation] = useState<CommandConfirmation | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [commandHistory, setCommandHistory] = useState<any[]>([]);
  const [vlaTrigger, setVlaTrigger] = useState(false);
  const [executionResult, setExecutionResult] = useState<string | null>(null);
  
  const logEndRef = useRef<HTMLDivElement>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('log', (log: any) => {
      setLogs(prev => [...prev, { 
        ...log, 
        timestamp: log.timestamp || new Date().toLocaleTimeString() 
      }].slice(-100));
    });

    newSocket.on('adb_status', (status: any) => {
      setAdbStatus(status);
      if (status.devices.length > 0 && !selectedDevice) {
        setSelectedDevice(status.devices[0].id);
      }
    });

    newSocket.on('agent_state', (state: 'idle' | 'processing' | 'confirming') => {
      setAgentState(state);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Fetch device info
  useEffect(() => {
    if (selectedDevice && adbStatus.connected) {
      const fetchDeviceInfo = async () => {
        try {
          const res = await axios.get('http://localhost:3001/api/adb/device-info', {
            params: { deviceId: selectedDevice }
          });
          if (res.data.success) {
            setDeviceInfo(res.data);
          }
        } catch (err) {
          console.error('Failed to fetch device info:', err);
        }
      };
      
      fetchDeviceInfo();
      const interval = setInterval(fetchDeviceInfo, 10000); // Update every 10s
      return () => clearInterval(interval);
    }
  }, [selectedDevice, adbStatus.connected]);

  // Fetch command history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/adb/command-history', {
          params: { limit: 20 }
        });
        if (res.data.success) {
          setCommandHistory(res.data.history);
        }
      } catch (err) {
        console.error('Failed to fetch command history:', err);
      }
    };
    
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  const takeScreenshot = async () => {
    if (!selectedDevice) return;
    
    try {
      const res = await axios.get('http://localhost:3001/api/adb/screenshot', {
        params: { deviceId: selectedDevice }
      });
      if (res.data.success) {
        setScreenshot(res.data.image);
      }
    } catch (err) {
      console.error('Failed to take screenshot:', err);
    }
  };

  const handleCliSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliInput.trim() || !selectedDevice) return;

    if (cliInput.startsWith('/shell ')) {
      const command = cliInput.replace('/shell ', '');
      try {
        setAgentState('processing');
        await axios.post('http://localhost:3001/api/adb/execute', { 
          command,
          deviceId: selectedDevice 
        });
      } catch (err) {
        console.error('Command execution failed:', err);
      } finally {
        setAgentState('idle');
      }
    } else {
      setLogs(prev => [...prev, { 
        type: 'system', 
        message: `Unknown command: ${cliInput}. Use /shell <adb command>`, 
        timestamp: new Date().toLocaleTimeString() 
      }]);
    }
    setCliInput('');
  };

  // VLA Loop: Trigger AI analysis
  const triggerVLALoop = async () => {
    if (!screenshot || !selectedDevice) return;

    try {
      setVlaTrigger(true);
      setAgentState('processing');

      const prompt = `Analyze this Android device screenshot and predict the next ADB command to execute. 
        Respond with the ADB command in the format: adb shell <command>
        Consider the current UI state and suggest a logical next action.`;

      const res = await axios.post('http://localhost:3001/api/ai/process', {
        model: selectedModel,
        prompt,
        screenshot,
        deviceId: selectedDevice
      });

      if (res.data.success) {
        setCommandConfirmation({
          sessionId: res.data.sessionId,
          predictedCommand: res.data.predictedCommand || 'shell input tap 500 500',
          confidence: res.data.confidence || 0.75,
          aiResponse: res.data.response
        });
        setAgentState('confirming');
      }
    } catch (err) {
      console.error('VLA loop failed:', err);
      setAgentState('idle');
    } finally {
      setVlaTrigger(false);
    }
  };

  // Execute AI-predicted command
  const executeAIPredictedCommand = async () => {
    if (!commandConfirmation || !selectedDevice) return;

    try {
      setAgentState('processing');
      const res = await axios.post('http://localhost:3001/api/adb/execute', {
        command: commandConfirmation.predictedCommand,
        deviceId: selectedDevice
      });

      if (res.data.success) {
        setExecutionResult(res.data.result);
        setLogs(prev => [...prev, {
          type: 'ai',
          message: `AI Command Executed: ${commandConfirmation.predictedCommand}`,
          result: res.data.result,
          timestamp: new Date().toLocaleTimeString()
        }]);
      }
    } catch (err) {
      console.error('Failed to execute AI command:', err);
    } finally {
      setCommandConfirmation(null);
      setAgentState('idle');
    }
  };

  // Reject AI prediction
  const rejectAIPrediction = () => {
    setCommandConfirmation(null);
    setAgentState('idle');
    setLogs(prev => [...prev, {
      type: 'system',
      message: 'AI prediction rejected by user',
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-cyber-black text-cyber-blue relative overflow-hidden">
      <div className="scanline" />
      
      {/* Header */}
      <header className="h-14 border-b border-cyber-blue/20 flex items-center justify-between px-6 bg-cyber-dark/50 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-cyber-blue/10 border border-cyber-blue flex items-center justify-center rounded-sm shadow-neon-blue">
            <Cpu size={18} className="text-cyber-blue" />
          </div>
          <h1 className="text-xl font-bold tracking-tighter text-white">
            DAV<span className="text-cyber-blue">CLAW</span> <span className="text-[10px] font-normal opacity-50">v2.0-BETA</span>
          </h1>
        </div>

        <div className="flex items-center gap-6">
          {/* Device Selector */}
          <select 
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="bg-cyber-gray border border-cyber-blue/30 text-cyber-blue text-[10px] px-2 py-1 outline-none focus:border-cyber-blue"
          >
            <option value="">Select Device</option>
            {adbStatus.devices.map(device => (
              <option key={device.id} value={device.id}>
                {device.id} ({device.status})
              </option>
            ))}
          </select>

          {/* ADB Status */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              adbStatus.connected ? "bg-cyber-green shadow-neon-green" : "bg-red-500 shadow-red-500/50"
            )} />
            <span className="text-[10px] uppercase tracking-widest font-bold">
              {adbStatus.connected ? "ADB BRIDGED" : "ADB DISCONNECTED"}
            </span>
          </div>
          
          {/* Model Selector */}
          <select 
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-cyber-gray border border-cyber-blue/30 text-cyber-blue text-[10px] px-2 py-1 outline-none focus:border-cyber-blue"
          >
            <option>Gemini</option>
            <option>Claude</option>
            <option>Ollama</option>
          </select>

          {/* Settings Button */}
          <button className="text-cyber-blue/40 hover:text-cyber-blue transition-colors">
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        
        {/* Left Panel: VLA Loop & Device View */}
        <section className="w-1/3 flex flex-col gap-4">
          {/* Device Screenshot */}
          <div className="flex-1 cyber-border rounded-lg p-4 flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Smartphone size={16} />
                <span className="text-xs font-bold uppercase">Device Stream</span>
                {deviceInfo && (
                  <span className="text-[9px] text-cyber-blue/60 ml-auto">
                    Battery: {deviceInfo.batteryLevel}%
                  </span>
                )}
              </div>
              <button 
                onClick={takeScreenshot}
                disabled={!selectedDevice}
                className="text-[10px] border border-cyber-blue/30 px-2 py-1 hover:bg-cyber-blue/10 disabled:opacity-50"
              >
                REFRESH
              </button>
            </div>
            
            <div className="flex-1 bg-black/40 rounded border border-white/5 flex items-center justify-center overflow-hidden relative">
              {screenshot ? (
                <img src={screenshot} alt="Device Screen" className="max-h-full object-contain" />
              ) : (
                <div className="text-cyber-blue/20 flex flex-col items-center gap-2">
                  <Activity size={48} className="animate-pulse" />
                  <span className="text-[10px] uppercase tracking-widest">
                    {selectedDevice ? 'No Signal' : 'Select Device'}
                  </span>
                </div>
              )}
              
              {/* AI Processing Overlay */}
              <AnimatePresence>
                {agentState === 'processing' && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-cyber-blue/5 flex items-center justify-center backdrop-blur-[1px]"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 border-2 border-cyber-blue border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-bold animate-pulse">AI ANALYZING...</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* VLA Trigger Button */}
            <button
              onClick={triggerVLALoop}
              disabled={!screenshot || !selectedDevice || vlaTrigger}
              className={cn(
                "mt-4 w-full py-2 border border-cyber-blue/30 rounded font-bold text-xs uppercase tracking-widest",
                "transition-all duration-300 flex items-center justify-center gap-2",
                vlaTrigger || agentState === 'processing'
                  ? "bg-cyber-yellow/20 text-cyber-yellow border-cyber-yellow/50 cursor-not-allowed"
                  : "hover:bg-cyber-blue/10 text-cyber-blue"
              )}
            >
              <Zap size={14} />
              {vlaTrigger ? 'ANALYZING...' : 'TRIGGER VLA LOOP'}
            </button>
          </div>

          {/* DAVSI Companion */}
          <div className="h-32 cyber-border rounded-lg p-4 flex items-center gap-4">
            <div className="w-20 h-20 relative">
              <motion.div 
                animate={agentState === 'processing' ? { 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-full h-full bg-cyber-blue/10 border border-cyber-blue/30 rounded-full flex items-center justify-center overflow-hidden"
              >
                {/* Avatar SVG */}
                <svg viewBox="0 0 100 100" className="w-12 h-12 fill-cyber-blue">
                  <path d="M50 20c-16.5 0-30 13.5-30 30s13.5 30 30 30 30-13.5 30-30-13.5-30-30-30zm0 50c-11 0-20-9-20-20s9-20 20-20 20 9 20 20-9 20-20 20z" />
                  <circle cx="35" cy="45" r="5" />
                  <circle cx="65" cy="45" r="5" />
                  <path d="M35 60s5 5 15 5 15-5 15-5" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
              </motion.div>
              <div className={cn(
                "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-cyber-black",
                agentState === 'processing' ? "bg-cyber-yellow" : 
                agentState === 'confirming' ? "bg-cyber-pink" : "bg-cyber-green"
              )} />
            </div>
            <div className="flex-1">
              <h3 className="text-xs font-bold text-white uppercase mb-1">DAVSI DAEMON</h3>
              <p className="text-[10px] text-cyber-blue/60 leading-tight">
                {agentState === 'processing' 
                  ? "Analyzing visual input and calculating next ADB action..." 
                  : agentState === 'confirming'
                  ? "Awaiting user confirmation for predicted command..."
                  : "System idle. Ready for VLA trigger or user command."}
              </p>
            </div>
          </div>
        </section>

        {/* Right Panel: Logs, Terminal & Command Confirmation */}
        <section className="flex-1 flex flex-col gap-4">
          {/* Command Confirmation Panel */}
          <AnimatePresence>
            {commandConfirmation && agentState === 'confirming' && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="cyber-border rounded-lg p-4 bg-cyber-dark/50 border-cyber-pink/50"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-cyber-pink" />
                    <h3 className="text-xs font-bold uppercase text-cyber-pink">AI Prediction Confirmation</h3>
                  </div>
                  <span className="text-[9px] text-cyber-blue/60">
                    Confidence: {(commandConfirmation.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                
                <div className="bg-black/40 rounded p-3 mb-3 border border-white/5">
                  <p className="text-[10px] text-cyber-blue/80 mb-2">Predicted Command:</p>
                  <code className="text-[11px] text-cyber-green font-mono">{commandConfirmation.predictedCommand}</code>
                </div>

                <div className="bg-black/40 rounded p-3 mb-3 border border-white/5 max-h-24 overflow-y-auto">
                  <p className="text-[10px] text-cyber-blue/80 mb-2">AI Analysis:</p>
                  <p className="text-[10px] text-white/70">{commandConfirmation.aiResponse}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={executeAIPredictedCommand}
                    className="flex-1 py-2 bg-cyber-green/20 border border-cyber-green/50 text-cyber-green text-xs font-bold uppercase rounded hover:bg-cyber-green/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <Check size={14} />
                    Execute
                  </button>
                  <button
                    onClick={rejectAIPrediction}
                    className="flex-1 py-2 bg-red-500/20 border border-red-500/50 text-red-500 text-xs font-bold uppercase rounded hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <X size={14} />
                    Reject
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Logs Panel */}
          <div className="flex-1 cyber-border rounded-lg flex flex-col overflow-hidden">
            <div className="h-10 border-b border-cyber-blue/20 flex items-center px-4 bg-cyber-blue/5 justify-between">
              <div className="flex items-center gap-2">
                <Terminal size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Real-time System Logs</span>
              </div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-[10px] text-cyber-blue/60 hover:text-cyber-blue transition-colors flex items-center gap-1"
              >
                <History size={12} />
                History
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[11px]">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                  <span className="opacity-30 shrink-0">[{log.timestamp}]</span>
                  <span className={cn(
                    "font-bold shrink-0 uppercase w-12",
                    log.type === 'adb' && "text-cyber-yellow",
                    log.type === 'ai' && "text-cyber-pink",
                    log.type === 'error' && "text-red-500",
                    log.type === 'system' && "text-cyber-blue"
                  )}>
                    {log.type}
                  </span>
                  <div className="flex-1">
                    <p className="text-white/90">{log.message}</p>
                    {log.result && (
                      <pre className="mt-1 p-2 bg-black/40 border border-white/5 text-cyber-green/80 overflow-x-auto text-[9px]">
                        {log.result.substring(0, 200)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>

            {/* CLI Input */}
            <form onSubmit={handleCliSubmit} className="h-12 border-t border-cyber-blue/20 flex items-center px-4 bg-black/40">
              <ChevronRight size={16} className="text-cyber-blue mr-2" />
              <input 
                type="text"
                value={cliInput}
                onChange={(e) => setCliInput(e.target.value)}
                placeholder="Enter command (e.g. /shell shell input tap 500 500)"
                disabled={!selectedDevice}
                className="flex-1 bg-transparent outline-none text-xs text-white placeholder:text-cyber-blue/20 disabled:opacity-50"
              />
              <button 
                type="submit" 
                disabled={!selectedDevice}
                className="text-cyber-blue/40 hover:text-cyber-blue transition-colors disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </section>

      </main>

      {/* Footer Status Bar */}
      <footer className="h-8 border-t border-cyber-blue/20 flex items-center justify-between px-6 bg-cyber-dark text-[9px] uppercase tracking-[0.2em] z-20">
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <span className="opacity-40">Devices:</span>
            <span className="text-cyber-green">{adbStatus.devices.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="opacity-40">Logs:</span>
            <span className="text-cyber-green">{logs.length}</span>
          </div>
          {deviceInfo && (
            <div className="flex items-center gap-2">
              <span className="opacity-40">Battery:</span>
              <span className={deviceInfo.batteryLevel > 20 ? "text-cyber-green" : "text-cyber-yellow"}>
                {deviceInfo.batteryLevel}%
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Activity size={10} className="text-cyber-green" />
          <span className="text-cyber-green">System Operational</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
