import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, TrendingUp, Clock, Zap } from 'lucide-react';
import { logsAPI, adbAPI } from '../services/api';
import { cn } from '../utils/cn';

interface DashboardStats {
  totalCommands: number;
  successRate: number;
  averageExecutionTime: number;
  totalErrors: number;
  uptime: number;
}

interface ExecutionTimeData {
  time: string;
  duration: number;
}

interface LogTypeDistribution {
  name: string;
  value: number;
  color: string;
}

interface DashboardProps {
  selectedDevice?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ selectedDevice }) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalCommands: 0,
    successRate: 0,
    averageExecutionTime: 0,
    totalErrors: 0,
    uptime: 0
  });
  const [executionTimes, setExecutionTimes] = useState<ExecutionTimeData[]>([]);
  const [logDistribution, setLogDistribution] = useState<LogTypeDistribution[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        // Fetch command history for stats
        const historyData = await adbAPI.getCommandHistory(100);
        if (historyData.success && historyData.history) {
          const commands = historyData.history;
          const successCount = commands.filter((c: any) => !c.error).length;
          const totalTime = commands.reduce((sum: number, c: any) => sum + (c.execution_time || 0), 0);
          const avgTime = commands.length > 0 ? totalTime / commands.length : 0;

          setStats({
            totalCommands: commands.length,
            successRate: commands.length > 0 ? (successCount / commands.length) * 100 : 0,
            averageExecutionTime: avgTime,
            totalErrors: commands.filter((c: any) => c.error).length,
            uptime: 99.5 // Mock uptime
          });

          // Prepare execution time chart data
          const timeData = commands
            .slice(-10)
            .reverse()
            .map((c: any, i: number) => ({
              time: `${i}`,
              duration: c.execution_time || 0
            }));
          setExecutionTimes(timeData);
        }

        // Fetch logs for distribution
        const logsData = await logsAPI.getLogs(100);
        if (logsData.success && logsData.logs) {
          const logs = logsData.logs;
          const distribution: { [key: string]: number } = {
            system: 0,
            adb: 0,
            ai: 0,
            error: 0
          };

          logs.forEach((log: any) => {
            if (log.type in distribution) {
              distribution[log.type]++;
            }
          });

          const colors = {
            system: '#00d9ff',
            adb: '#ffff00',
            ai: '#ff00ff',
            error: '#ff0000'
          };

          setLogDistribution([
            { name: 'System', value: distribution.system, color: colors.system },
            { name: 'ADB', value: distribution.adb, color: colors.adb },
            { name: 'AI', value: distribution.ai, color: colors.ai },
            { name: 'Error', value: distribution.error, color: colors.error }
          ]);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 15000); // Update every 15s

    return () => clearInterval(interval);
  }, [selectedDevice]);

  const StatCard = ({ icon: Icon, label, value, unit, color }: any) => (
    <div className="cyber-border rounded-lg p-3 bg-cyber-dark/30 border-cyber-blue/20">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={color} />
        <span className="text-[9px] uppercase text-cyber-blue/60">{label}</span>
      </div>
      <div className="text-lg font-bold text-white">
        {value.toFixed(1)}<span className="text-xs text-cyber-blue/60 ml-1">{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Activity}
          label="Total Commands"
          value={stats.totalCommands}
          unit="cmd"
          color="text-cyber-green"
        />
        <StatCard
          icon={TrendingUp}
          label="Success Rate"
          value={stats.successRate}
          unit="%"
          color="text-cyber-blue"
        />
        <StatCard
          icon={Clock}
          label="Avg Execution"
          value={stats.averageExecutionTime}
          unit="ms"
          color="text-cyber-yellow"
        />
        <StatCard
          icon={Zap}
          label="Errors"
          value={stats.totalErrors}
          unit="err"
          color="text-red-500"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-3">
        {/* Execution Time Chart */}
        <div className="cyber-border rounded-lg p-3 bg-cyber-dark/30 border-cyber-blue/20 overflow-hidden">
          <p className="text-[9px] uppercase text-cyber-blue/60 mb-2">Execution Times</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={executionTimes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00d9ff20" />
              <XAxis dataKey="time" stroke="#00d9ff40" tick={{ fontSize: 10 }} />
              <YAxis stroke="#00d9ff40" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0a0e27',
                  border: '1px solid #00d9ff',
                  borderRadius: '4px'
                }}
                labelStyle={{ color: '#00d9ff' }}
              />
              <Bar dataKey="duration" fill="#00d9ff" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Log Distribution Chart */}
        <div className="cyber-border rounded-lg p-3 bg-cyber-dark/30 border-cyber-blue/20 overflow-hidden">
          <p className="text-[9px] uppercase text-cyber-blue/60 mb-2">Log Distribution</p>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={logDistribution}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={50}
                paddingAngle={2}
                dataKey="value"
              >
                {logDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0a0e27',
                  border: '1px solid #00d9ff',
                  borderRadius: '4px'
                }}
                labelStyle={{ color: '#00d9ff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="cyber-border rounded-lg p-3 bg-cyber-dark/30 border-cyber-blue/20">
        <p className="text-[9px] uppercase text-cyber-blue/60 mb-2">Legend</p>
        <div className="grid grid-cols-2 gap-2 text-[9px]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyber-green" />
            <span className="text-cyber-blue/60">System</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyber-yellow" />
            <span className="text-cyber-blue/60">ADB</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyber-pink" />
            <span className="text-cyber-blue/60">AI</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-cyber-blue/60">Error</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
