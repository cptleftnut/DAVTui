import React, { useEffect, useState } from 'react';
import { History, Copy, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { adbAPI } from '../services/api';
import { cn } from '../utils/cn';

interface CommandRecord {
  id: number;
  command: string;
  result?: string;
  error?: string;
  execution_time: number;
  timestamp: string;
  device_id?: string;
}

interface CommandHistoryProps {
  limit?: number;
  onCommandSelect?: (command: string) => void;
}

export const CommandHistory: React.FC<CommandHistoryProps> = ({ limit = 20, onCommandSelect }) => {
  const [history, setHistory] = useState<CommandRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await adbAPI.getCommandHistory(limit);
        if (data.success) {
          setHistory(data.history);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch command history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);

    return () => clearInterval(interval);
  }, [limit]);

  const copyToClipboard = (command: string) => {
    navigator.clipboard.writeText(command);
  };

  const getStatusIcon = (record: CommandRecord) => {
    if (record.error) {
      return <AlertCircle size={14} className="text-red-500" />;
    }
    return <CheckCircle size={14} className="text-cyber-green" />;
  };

  if (error) {
    return (
      <div className="cyber-border rounded-lg p-4 bg-red-500/10 border-red-500/30">
        <div className="flex items-center gap-2 text-red-500">
          <AlertCircle size={16} />
          <span className="text-xs">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="cyber-border rounded-lg bg-cyber-dark/30 border-cyber-blue/20 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="h-10 border-b border-cyber-blue/20 flex items-center px-4 bg-cyber-blue/5">
        <History size={14} className="text-cyber-blue mr-2" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-cyber-blue">
          Command History ({history.length})
        </span>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-cyber-blue/40">
            <span className="text-xs">
              {loading ? 'Loading...' : 'No command history'}
            </span>
          </div>
        ) : (
          <div className="divide-y divide-cyber-blue/10">
            {history.map((record) => (
              <div
                key={record.id}
                className="p-3 hover:bg-white/5 transition-colors cursor-pointer border-b border-cyber-blue/10"
                onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
              >
                {/* Command Header */}
                <div className="flex items-start gap-2 mb-2">
                  {getStatusIcon(record)}
                  <div className="flex-1 min-w-0">
                    <code className="text-[10px] text-cyber-green font-mono break-all">
                      adb {record.command}
                    </code>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-cyber-blue/60">
                        {new Date(record.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-[9px] text-cyber-yellow">
                        {record.execution_time}ms
                      </span>
                      {record.device_id && (
                        <span className="text-[9px] text-cyber-blue/60">
                          {record.device_id}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(record.command);
                      }}
                      title="Copy command"
                      className="p-1 text-cyber-blue/60 hover:text-cyber-blue transition-colors"
                    >
                      <Copy size={12} />
                    </button>
                    {onCommandSelect && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCommandSelect(record.command);
                        }}
                        title="Re-execute command"
                        className="p-1 text-cyber-blue/60 hover:text-cyber-yellow transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === record.id && (
                  <div className="mt-2 pt-2 border-t border-cyber-blue/10 space-y-2">
                    {record.result && (
                      <div>
                        <p className="text-[9px] text-cyber-blue/60 uppercase mb-1">Output:</p>
                        <pre className="bg-black/60 border border-white/5 rounded p-2 text-[9px] text-cyber-green/80 overflow-x-auto max-h-32 overflow-y-auto">
                          {record.result.substring(0, 500)}
                          {record.result.length > 500 && '\n...'}
                        </pre>
                      </div>
                    )}
                    {record.error && (
                      <div>
                        <p className="text-[9px] text-red-500/60 uppercase mb-1">Error:</p>
                        <pre className="bg-red-500/10 border border-red-500/30 rounded p-2 text-[9px] text-red-500 overflow-x-auto max-h-32 overflow-y-auto">
                          {record.error.substring(0, 500)}
                          {record.error.length > 500 && '\n...'}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommandHistory;
