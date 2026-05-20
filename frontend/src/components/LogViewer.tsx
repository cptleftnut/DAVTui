import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Search, Filter, Download, Trash2 } from 'lucide-react';
import { cn } from '../utils/cn';

export interface LogEntry {
  id?: number;
  type: 'system' | 'adb' | 'ai' | 'error';
  message: string;
  result?: string;
  timestamp: string;
}

interface LogViewerProps {
  logs: LogEntry[];
  onClear?: () => void;
  onExport?: () => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs, onClear, onExport }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'system' | 'adb' | 'ai' | 'error'>('all');
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>(logs);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let filtered = logs;

    if (filterType !== 'all') {
      filtered = filtered.filter(log => log.type === filterType);
    }

    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.result && log.result.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, filterType]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredLogs]);

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'adb':
        return 'text-cyber-yellow';
      case 'ai':
        return 'text-cyber-pink';
      case 'error':
        return 'text-red-500';
      case 'system':
      default:
        return 'text-cyber-blue';
    }
  };

  const handleExport = () => {
    const logText = filteredLogs
      .map(log => `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}${log.result ? '\n' + log.result : ''}`)
      .join('\n\n');

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(logText));
    element.setAttribute('download', `davclaw-logs-${Date.now()}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    onExport?.();
  };

  return (
    <div className="flex flex-col h-full bg-cyber-dark/30 rounded-lg border border-cyber-blue/20 overflow-hidden">
      {/* Header */}
      <div className="h-10 border-b border-cyber-blue/20 flex items-center px-4 bg-cyber-blue/5 gap-3 flex-shrink-0">
        <Terminal size={14} className="text-cyber-blue" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-cyber-blue flex-1">
          System Logs ({filteredLogs.length})
        </span>
        
        {/* Action Buttons */}
        <button
          onClick={handleExport}
          title="Export logs"
          className="p-1 text-cyber-blue/60 hover:text-cyber-blue transition-colors"
        >
          <Download size={14} />
        </button>
        
        {onClear && (
          <button
            onClick={onClear}
            title="Clear logs"
            className="p-1 text-cyber-blue/60 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Search & Filter */}
      <div className="px-4 py-2 border-b border-cyber-blue/20 bg-black/40 flex gap-2 flex-shrink-0">
        <div className="flex-1 relative">
          <Search size={12} className="absolute left-2 top-2.5 text-cyber-blue/40" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/60 border border-cyber-blue/20 rounded px-2 py-1 pl-6 text-[10px] text-white placeholder:text-cyber-blue/30 outline-none focus:border-cyber-blue/50"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="bg-black/60 border border-cyber-blue/20 rounded px-2 py-1 text-[10px] text-cyber-blue outline-none focus:border-cyber-blue/50"
        >
          <option value="all">All Types</option>
          <option value="system">System</option>
          <option value="adb">ADB</option>
          <option value="ai">AI</option>
          <option value="error">Error</option>
        </select>
      </div>

      {/* Logs Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[11px]">
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-cyber-blue/40">
            <span className="text-xs">No logs to display</span>
          </div>
        ) : (
          filteredLogs.map((log, i) => (
            <div
              key={i}
              className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300 hover:bg-white/5 p-2 rounded transition-colors"
            >
              <span className="opacity-30 shrink-0 text-[9px]">[{log.timestamp}]</span>
              <span className={cn(
                "font-bold shrink-0 uppercase w-12 text-[10px]",
                getLogColor(log.type)
              )}>
                {log.type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white/90 break-words">{log.message}</p>
                {log.result && (
                  <pre className="mt-1 p-2 bg-black/60 border border-white/5 text-cyber-green/80 overflow-x-auto text-[9px] rounded">
                    {log.result.substring(0, 300)}
                    {log.result.length > 300 && '...'}
                  </pre>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

export default LogViewer;
