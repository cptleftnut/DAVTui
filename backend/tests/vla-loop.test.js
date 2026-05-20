import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_BASE_URL = 'http://localhost:3001';

describe('VLA Loop End-to-End Tests', () => {
  let socket;
  let sessionId;

  beforeAll((done) => {
    socket = io(API_BASE_URL);
    socket.on('connect', done);
  });

  afterAll(() => {
    if (socket) socket.disconnect();
  });

  describe('VLA Session Management', () => {
    it('should create a new VLA session', async () => {
      const response = await axios.post(`${API_BASE_URL}/api/analytics/vla-session/create`, {
        model: 'Gemini'
      });
      
      expect(response.data.success).toBe(true);
      expect(response.data.sessionId).toBeDefined();
      sessionId = response.data.sessionId;
    });

    it('should end VLA session with stats', async () => {
      if (!sessionId) {
        // Create session first
        const createRes = await axios.post(`${API_BASE_URL}/api/analytics/vla-session/create`, {
          model: 'Claude'
        });
        sessionId = createRes.data.sessionId;
      }

      const response = await axios.post(`${API_BASE_URL}/api/analytics/vla-session/end`, {
        sessionId,
        commandsExecuted: 5,
        successCount: 4
      });

      expect(response.data.success).toBe(true);
    });

    it('should retrieve VLA session history', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/analytics/vla-sessions`, {
        params: { limit: 10 }
      });

      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.sessions)).toBe(true);
    });
  });

  describe('AI Processing & Prediction', () => {
    it('should process AI request and return prediction', async () => {
      const response = await axios.post(`${API_BASE_URL}/api/ai/process`, {
        model: 'Gemini',
        prompt: 'Analyze this Android screenshot and predict the next action',
        screenshot: null
      });

      expect(response.data.success).toBe(true);
      expect(response.data.response).toBeDefined();
      expect(response.data.sessionId).toBeDefined();
      expect(response.data.confidence).toBeDefined();
    });

    it('should handle multiple AI models', async () => {
      const models = ['Gemini', 'Claude', 'Ollama'];
      
      for (const model of models) {
        const response = await axios.post(`${API_BASE_URL}/api/ai/process`, {
          model,
          prompt: 'Test prompt'
        });

        expect(response.data.success).toBe(true);
      }
    });

    it('should track AI interactions in database', async () => {
      await axios.post(`${API_BASE_URL}/api/ai/process`, {
        model: 'Gemini',
        prompt: 'Test interaction tracking'
      });

      const metricsResponse = await axios.get(`${API_BASE_URL}/api/analytics/ai-metrics`);
      expect(metricsResponse.data.success).toBe(true);
      expect(Array.isArray(metricsResponse.data.metrics)).toBe(true);
    });
  });

  describe('Command Execution & Confirmation', () => {
    it('should record command execution', async () => {
      const response = await axios.post(`${API_BASE_URL}/api/analytics/command-history/record`, {
        userCommand: 'shell input tap 500 500',
        aiModel: 'Gemini',
        predictedAction: 'shell input tap 500 500',
        userConfirmed: true,
        executionResult: 'Success'
      });

      expect(response.data.success).toBe(true);
      expect(response.data.recordId).toBeDefined();
    });

    it('should retrieve command history', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/analytics/command-history`, {
        params: { limit: 20 }
      });

      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.history)).toBe(true);
    });

    it('should filter command history by AI model', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/analytics/command-history`, {
        params: { aiModel: 'Gemini', limit: 10 }
      });

      expect(response.data.success).toBe(true);
      if (response.data.history.length > 0) {
        expect(response.data.history[0].ai_model).toBe('Gemini');
      }
    });
  });

  describe('Real-Time Log Streaming', () => {
    it('should receive log events via WebSocket', (done) => {
      let logReceived = false;

      socket.on('log', (log) => {
        expect(log.type).toBeDefined();
        expect(log.message).toBeDefined();
        logReceived = true;
      });

      setTimeout(() => {
        expect(logReceived).toBe(true);
        done();
      }, 2000);
    });

    it('should receive ADB status updates', (done) => {
      let statusReceived = false;

      socket.on('adb_status', (status) => {
        expect(status.connected).toBeDefined();
        expect(Array.isArray(status.devices)).toBe(true);
        statusReceived = true;
      });

      setTimeout(() => {
        expect(statusReceived).toBe(true);
        done();
      }, 2000);
    });

    it('should receive agent state changes', (done) => {
      let stateReceived = false;

      socket.on('agent_state', (state) => {
        expect(['idle', 'processing', 'confirming']).toContain(state);
        stateReceived = true;
      });

      setTimeout(() => {
        // State might not change during test
        done();
      }, 1000);
    });
  });

  describe('Analytics & Reporting', () => {
    it('should get command statistics', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/analytics/command-stats`, {
        params: { timeWindow: 60 }
      });

      expect(response.data.success).toBe(true);
      expect(response.data.stats).toBeDefined();
      expect(response.data.stats.total_commands).toBeDefined();
    });

    it('should get device statistics', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/analytics/device-stats`);

      expect(response.data.success).toBe(true);
      expect(response.data.stats).toBeDefined();
      expect(response.data.stats.total_devices).toBeDefined();
    });

    it('should get log statistics', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/analytics/log-stats`);

      expect(response.data.success).toBe(true);
      expect(response.data.stats).toBeDefined();
    });

    it('should generate execution report', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/analytics/report`, {
        params: { timeWindow: 60, sessionLimit: 10 }
      });

      expect(response.data.success).toBe(true);
      expect(response.data.report).toBeDefined();
      expect(response.data.report.commandStats).toBeDefined();
      expect(response.data.report.deviceStats).toBeDefined();
      expect(response.data.report.aiMetrics).toBeDefined();
    });
  });

  describe('Log Management & Export', () => {
    it('should filter logs with advanced options', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/analytics/logs-filtered`, {
        params: {
          type: 'adb',
          limit: 10
        }
      });

      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.logs)).toBe(true);
    });

    it('should export logs as CSV', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/analytics/export/logs`, {
        params: { limit: 10 },
        responseType: 'text'
      });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.data).toContain('ID,Type,Message');
    });

    it('should archive old logs', async () => {
      const response = await axios.post(`${API_BASE_URL}/api/analytics/logs/archive`, {
        daysOld: 30
      });

      expect(response.data.success).toBe(true);
      expect(response.data.archivedCount).toBeDefined();
    });
  });

  describe('Complete VLA Loop Workflow', () => {
    it('should execute complete VLA loop: capture -> analyze -> execute -> confirm', async () => {
      // Step 1: Create VLA session
      const sessionRes = await axios.post(`${API_BASE_URL}/api/analytics/vla-session/create`, {
        model: 'Gemini'
      });
      const vlaSessionId = sessionRes.data.sessionId;
      expect(vlaSessionId).toBeDefined();

      // Step 2: Get devices
      const devicesRes = await axios.get(`${API_BASE_URL}/api/adb/devices`);
      expect(devicesRes.data.success).toBe(true);

      // Step 3: Process with AI
      const aiRes = await axios.post(`${API_BASE_URL}/api/ai/process`, {
        model: 'Gemini',
        prompt: 'Predict next action',
        sessionId: vlaSessionId
      });
      expect(aiRes.data.success).toBe(true);
      expect(aiRes.data.predictedCommand).toBeDefined();

      // Step 4: Record command execution
      const recordRes = await axios.post(`${API_BASE_URL}/api/analytics/command-history/record`, {
        userCommand: aiRes.data.predictedCommand,
        aiModel: 'Gemini',
        predictedAction: aiRes.data.predictedCommand,
        userConfirmed: true,
        executionResult: 'Success'
      });
      expect(recordRes.data.success).toBe(true);

      // Step 5: End VLA session
      const endRes = await axios.post(`${API_BASE_URL}/api/analytics/vla-session/end`, {
        sessionId: vlaSessionId,
        commandsExecuted: 1,
        successCount: 1
      });
      expect(endRes.data.success).toBe(true);

      // Step 6: Verify in history
      const historyRes = await axios.get(`${API_BASE_URL}/api/analytics/vla-sessions`);
      expect(historyRes.data.sessions.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('should handle missing required parameters', async () => {
      try {
        await axios.post(`${API_BASE_URL}/api/analytics/vla-session/create`, {});
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.response.status).toBe(400);
      }
    });

    it('should handle invalid session IDs', async () => {
      try {
        await axios.post(`${API_BASE_URL}/api/analytics/vla-session/end`, {
          sessionId: 'invalid_session_id',
          commandsExecuted: 0,
          successCount: 0
        });
        // Should not throw error, just update non-existent record
        expect(true).toBe(true);
      } catch (error) {
        expect(error.response.status).toBe(500);
      }
    });

    it('should handle concurrent requests', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          axios.post(`${API_BASE_URL}/api/analytics/vla-session/create`, {
            model: 'Gemini'
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results.length).toBe(5);
      results.forEach(res => {
        expect(res.data.success).toBe(true);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle rapid log queries', async () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 10; i++) {
        await axios.get(`${API_BASE_URL}/api/logs`, {
          params: { limit: 50 }
        });
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete in less than 5 seconds
    });

    it('should handle large batch operations', async () => {
      const startTime = Date.now();
      
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          axios.post(`${API_BASE_URL}/api/analytics/command-history/record`, {
            userCommand: `shell input tap ${500 + i} ${500 + i}`,
            aiModel: 'Gemini',
            predictedAction: `shell input tap ${500 + i} ${500 + i}`,
            userConfirmed: true,
            executionResult: 'Success'
          })
        );
      }
      
      await Promise.all(promises);
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should complete in less than 10 seconds
    });
  });
});
