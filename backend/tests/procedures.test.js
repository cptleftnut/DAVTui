import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001';

describe('DAVClaw Backend Procedures', () => {
  
  describe('ADB Bridge Service', () => {
    it('should retrieve connected devices', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/adb/devices`);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.devices)).toBe(true);
    });

    it('should execute ADB command successfully', async () => {
      const response = await axios.post(`${API_BASE_URL}/api/adb/execute`, {
        command: 'shell getprop ro.product.model'
      });
      expect(response.data.success).toBe(true);
      expect(response.data.result).toBeDefined();
      expect(response.data.executionTime).toBeDefined();
    });

    it('should handle invalid ADB commands', async () => {
      try {
        await axios.post(`${API_BASE_URL}/api/adb/execute`, {
          command: 'invalid_command_xyz'
        });
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.response.status).toBe(500);
        expect(error.response.data.success).toBe(false);
      }
    });

    it('should require command parameter', async () => {
      try {
        await axios.post(`${API_BASE_URL}/api/adb/execute`, {});
        expect(false).toBe(true);
      } catch (error) {
        expect(error.response.status).toBe(400);
      }
    });
  });

  describe('Device Information', () => {
    it('should retrieve device info', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/adb/devices`);
      if (response.data.devices.length > 0) {
        const deviceId = response.data.devices[0].id;
        const infoResponse = await axios.get(`${API_BASE_URL}/api/adb/device-info`, {
          params: { deviceId }
        });
        expect(infoResponse.data.success).toBe(true);
        expect(infoResponse.data.model).toBeDefined();
        expect(infoResponse.data.androidVersion).toBeDefined();
        expect(infoResponse.data.batteryLevel).toBeDefined();
      }
    });
  });

  describe('Filesystem API', () => {
    it('should retrieve project tree', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/fs/tree`);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.tree)).toBe(true);
    });

    it('should prevent directory traversal', async () => {
      try {
        await axios.get(`${API_BASE_URL}/api/fs/read`, {
          params: { filePath: '../../../../etc/passwd' }
        });
        expect(false).toBe(true);
      } catch (error) {
        expect(error.response.status).toBe(403);
      }
    });
  });

  describe('Logging System', () => {
    it('should retrieve logs', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/logs`, {
        params: { limit: 10 }
      });
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.logs)).toBe(true);
    });

    it('should filter logs by type', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/logs`, {
        params: { type: 'adb', limit: 10 }
      });
      expect(response.data.success).toBe(true);
      if (response.data.logs.length > 0) {
        expect(response.data.logs[0].type).toBe('adb');
      }
    });

    it('should retrieve command history', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/adb/command-history`, {
        params: { limit: 20 }
      });
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.history)).toBe(true);
    });
  });

  describe('AI Integration', () => {
    it('should process AI request with mock response', async () => {
      const response = await axios.post(`${API_BASE_URL}/api/ai/process`, {
        model: 'mock',
        prompt: 'Test prompt',
        screenshot: null
      });
      expect(response.data.success).toBe(true);
      expect(response.data.response).toBeDefined();
      expect(response.data.sessionId).toBeDefined();
    });

    it('should require model and prompt', async () => {
      try {
        await axios.post(`${API_BASE_URL}/api/ai/process`, {});
        expect(false).toBe(true);
      } catch (error) {
        expect(error.response.status).toBe(400);
      }
    });

    it('should handle AI processing timeout', async () => {
      const response = await axios.post(`${API_BASE_URL}/api/ai/process`, {
        model: 'mock',
        prompt: 'Test prompt with long processing time',
        screenshot: null
      });
      expect(response.data.success).toBe(true);
      expect(response.data.sessionId).toBeDefined();
    }, { timeout: 5000 });
  });

  describe('Device State Tracking', () => {
    it('should retrieve device state', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/device-state`);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.devices)).toBe(true);
    });
  });

  describe('WebSocket Communication', () => {
    it('should establish WebSocket connection', async () => {
      const { io } = await import('socket.io-client');
      const socket = io('http://localhost:3001');
      
      return new Promise((resolve, reject) => {
        socket.on('connect', () => {
          expect(socket.connected).toBe(true);
          socket.disconnect();
          resolve(true);
        });
        
        socket.on('error', reject);
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
    });

    it('should receive log events via WebSocket', async () => {
      const { io } = await import('socket.io-client');
      const socket = io('http://localhost:3001');
      
      return new Promise((resolve, reject) => {
        let logReceived = false;
        
        socket.on('log', (log) => {
          logReceived = true;
          expect(log.type).toBeDefined();
          expect(log.message).toBeDefined();
        });
        
        socket.on('connect', () => {
          setTimeout(() => {
            socket.disconnect();
            if (logReceived) {
              resolve(true);
            } else {
              reject(new Error('No log event received'));
            }
          }, 2000);
        });
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      try {
        await axios.get(`${API_BASE_URL}/api/invalid-endpoint`);
        expect(false).toBe(true);
      } catch (error) {
        expect(error.response.status).toBe(404);
      }
    });

    it('should validate request parameters', async () => {
      try {
        await axios.post(`${API_BASE_URL}/api/adb/execute`, {
          command: null
        });
        expect(false).toBe(true);
      } catch (error) {
        expect(error.response.status).toBe(400);
      }
    });
  });
});
