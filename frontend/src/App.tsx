import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { 
  Terminal, 
  Cpu, 
  Smartphone, 
  Activity, 
  Send,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LogEntry {
  type: 'system' | 'adb' | 'ai' | 'error';
  message: string;
  result?: string;
  timestamp: string;
}

const App: React.FC = () => {
  const [, setSocket] = useState<Socket | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [adbStatus, setAdbStatus] = useState<{ connected: boolean; devices: string[] }>({ connected: false, devices: [] });
  const [agentState, setAgentState] = useState<'idle' | 'processing'>('idle');
  const [selectedModel, setSelectedModel] = useState('Gemini 1.5 Pro');
  const [cliInput, setCliInput] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('log', (log: any) => {
      setLogs(prev => [...prev, { ...log, timestamp: new Date().toLocaleTimeString() }].slice(-100));
    });

    newSocket.on('adb_status', (status: any) => {
      setAdbStatus(status);
    });

    newSocket.on('agent_state', (state: 'idle' | 'processing') => {
      setAgentState(state);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleCliSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliInput.trim()) return;

    if (cliInput.startsWith('/shell ')) {
      const command = cliInput.replace('/shell ', '');
      try {
        await axios.post('http://localhost:3001/api/adb/execute', { command });
      } catch (err) {
        console.error(err);
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

  const takeScreenshot = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/adb/screenshot');
      if (res.data.success) {
        setScreenshot(res.data.image);
      }
    } catch (err) {
      console.error(err);
    }
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
            DAV<span className="text-cyber-blue">CLAW</span> <span className="text-[10px] font-normal opacity-50">v1.0.4-ALPHA</span>
          </h1>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              adbStatus.connected ? "bg-cyber-green shadow-neon-green" : "bg-red-500 shadow-red-500/50"
            )} />
            <span className="text-[10px] uppercase tracking-widest font-bold">
              {adbStatus.connected ? "ADB BRIDGED" : "ADB DISCONNECTED"}
            </span>
          </div>
          
          <select 
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-cyber-gray border border-cyber-blue/30 text-cyber-blue text-[10px] px-2 py-1 outline-none focus:border-cyber-blue"
          >
            <option>Gemini 1.5 Pro</option>
            <option>Claude 3.5 Sonnet</option>
            <option>Ollama (Llama 3)</option>
            <option>Groq (Mixtral)</option>
          </select>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        
        {/* Left Panel: VLA Loop & Device View */}
        <section className="w-1/3 flex flex-col gap-4">
          <div className="flex-1 cyber-border rounded-lg p-4 flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Smartphone size={16} />
                <span className="text-xs font-bold uppercase">Device Stream</span>
              </div>
              <button 
                onClick={takeScreenshot}
                className="text-[10px] border border-cyber-blue/30 px-2 py-1 hover:bg-cyber-blue/10"
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
                  <span className="text-[10px] uppercase tracking-widest">No Signal</span>
                </div>
              )}
              
              {/* VLA Overlay */}
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
                {/* Simple SVG Avatar */}
                <svg viewBox="0 0 100 100" className="w-12 h-12 fill-cyber-blue">
                  <path d="M50 20c-16.5 0-30 13.5-30 30s13.5 30 30 30 30-13.5 30-30-13.5-30-30-30zm0 50c-11 0-20-9-20-20s9-20 20-20 20 9 20 20-9 20-20 20z" />
                  <circle cx="35" cy="45" r="5" />
                  <circle cx="65" cy="45" r="5" />
                  <path d="M35 60s5 5 15 5 15-5 15-5" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
              </motion.div>
              <div className={cn(
                "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-cyber-black",
                agentState === 'processing' ? "bg-cyber-yellow" : "bg-cyber-green"
              )} />
            </div>
            <div className="flex-1">
              <h3 className="text-xs font-bold text-white uppercase mb-1">DAVSI DAEMON</h3>
              <p className="text-[10px] text-cyber-blue/60 leading-tight">
                {agentState === 'processing' 
                  ? "Analyzing visual input and calculating next ADB action..." 
                  : "System idle. Waiting for user command or VLA trigger."}
              </p>
            </div>
          </div>
        </section>

        {/* Right Panel: Logs & Terminal */}
        <section className="flex-1 flex flex-col gap-4">
          <div className="flex-1 cyber-border rounded-lg flex flex-col overflow-hidden">
            <div className="h-10 border-b border-cyber-blue/20 flex items-center px-4 bg-cyber-blue/5">
              <Terminal size={14} className="mr-2" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Real-time System Logs</span>
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
                      <pre className="mt-1 p-2 bg-black/40 border border-white/5 text-cyber-green/80 overflow-x-auto">
                        {log.result}
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
                className="flex-1 bg-transparent outline-none text-xs text-white placeholder:text-cyber-blue/20"
              />
              <button type="submit" className="text-cyber-blue/40 hover:text-cyber-blue transition-colors">
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
            <span className="opacity-40">CPU:</span>
            <span className="text-cyber-green">12%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="opacity-40">MEM:</span>
            <span className="text-cyber-green">1.2GB</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="opacity-40">LATENCY:</span>
            <span className="text-cyber-yellow">42ms</span>
          </div>
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
