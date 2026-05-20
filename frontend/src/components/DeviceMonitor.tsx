import React, { useEffect, useState } from 'react';
import { Smartphone, Battery, AlertCircle, CheckCircle } from 'lucide-react';
import { adbAPI } from '../services/api';
import { cn } from '../utils/cn';

interface DeviceInfo {
  model: string;
  androidVersion: string;
  batteryLevel: number;
  timestamp: string;
}

interface DeviceMonitorProps {
  deviceId?: string;
  onRefresh?: () => void;
}

export const DeviceMonitor: React.FC<DeviceMonitorProps> = ({ deviceId, onRefresh }) => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) return;

    const fetchDeviceInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await adbAPI.getDeviceInfo(deviceId);
        if (data.success) {
          setDeviceInfo(data);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch device info');
      } finally {
        setLoading(false);
      }
    };

    fetchDeviceInfo();
    const interval = setInterval(fetchDeviceInfo, 10000); // Update every 10s

    return () => clearInterval(interval);
  }, [deviceId]);

  if (!deviceId) {
    return (
      <div className="cyber-border rounded-lg p-4 bg-cyber-dark/30 border-cyber-blue/20">
        <div className="flex items-center gap-2 text-cyber-blue/60">
          <AlertCircle size={16} />
          <span className="text-xs">Select a device to monitor</span>
        </div>
      </div>
    );
  }

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
    <div className="cyber-border rounded-lg p-4 bg-cyber-dark/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-cyber-blue" />
          <span className="text-xs font-bold uppercase text-cyber-blue">Device Monitor</span>
        </div>
        {loading && (
          <div className="w-3 h-3 rounded-full bg-cyber-yellow animate-pulse" />
        )}
      </div>

      {deviceInfo ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/40 rounded p-2 border border-white/5">
              <p className="text-[9px] text-cyber-blue/60 uppercase">Model</p>
              <p className="text-[11px] text-white font-mono">{deviceInfo.model}</p>
            </div>

            <div className="bg-black/40 rounded p-2 border border-white/5">
              <p className="text-[9px] text-cyber-blue/60 uppercase">Android</p>
              <p className="text-[11px] text-white font-mono">{deviceInfo.androidVersion}</p>
            </div>
          </div>

          <div className="bg-black/40 rounded p-2 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] text-cyber-blue/60 uppercase">Battery</p>
              <span className="text-[10px] text-cyber-green font-bold">{deviceInfo.batteryLevel}%</span>
            </div>
            <div className="w-full h-2 bg-black/60 rounded border border-white/10 overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  deviceInfo.batteryLevel > 50 ? "bg-cyber-green" :
                  deviceInfo.batteryLevel > 20 ? "bg-cyber-yellow" :
                  "bg-red-500"
                )}
                style={{ width: `${deviceInfo.batteryLevel}%` }}
              />
            </div>
          </div>

          <p className="text-[8px] text-cyber-blue/40 text-right">
            Updated: {new Date(deviceInfo.timestamp).toLocaleTimeString()}
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-center py-6 text-cyber-blue/40">
          <span className="text-xs">Loading device info...</span>
        </div>
      )}
    </div>
  );
};

export default DeviceMonitor;
