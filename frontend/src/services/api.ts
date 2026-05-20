import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`[API] Response: ${response.status}`, response.data);
    return response;
  },
  (error) => {
    console.error('[API] Response error:', error.response?.status, error.message);
    return Promise.reject(error);
  }
);

// ============================================================================
// ADB ENDPOINTS
// ============================================================================

export const adbAPI = {
  getDevices: async () => {
    const response = await api.get('/api/adb/devices');
    return response.data;
  },

  executeCommand: async (command: string, deviceId?: string) => {
    const response = await api.post('/api/adb/execute', {
      command,
      deviceId
    });
    return response.data;
  },

  getScreenshot: async (deviceId?: string) => {
    const response = await api.get('/api/adb/screenshot', {
      params: { deviceId }
    });
    return response.data;
  },

  getDeviceInfo: async (deviceId?: string) => {
    const response = await api.get('/api/adb/device-info', {
      params: { deviceId }
    });
    return response.data;
  },

  getCommandHistory: async (limit: number = 50) => {
    const response = await api.get('/api/adb/command-history', {
      params: { limit }
    });
    return response.data;
  }
};

// ============================================================================
// AI ENDPOINTS
// ============================================================================

export const aiAPI = {
  processWithAI: async (
    model: string,
    prompt: string,
    screenshot?: string,
    deviceId?: string,
    sessionId?: string
  ) => {
    const response = await api.post('/api/ai/process', {
      model,
      prompt,
      screenshot,
      deviceId,
      sessionId
    });
    return response.data;
  }
};

// ============================================================================
// FILESYSTEM ENDPOINTS
// ============================================================================

export const fsAPI = {
  getTree: async () => {
    const response = await api.get('/api/fs/tree');
    return response.data;
  },

  readFile: async (filePath: string) => {
    const response = await api.get('/api/fs/read', {
      params: { filePath }
    });
    return response.data;
  }
};

// ============================================================================
// LOGGING ENDPOINTS
// ============================================================================

export const logsAPI = {
  getLogs: async (limit: number = 100, type?: string) => {
    const response = await api.get('/api/logs', {
      params: { limit, type }
    });
    return response.data;
  },

  getLogsByType: async (type: string, limit: number = 50) => {
    return logsAPI.getLogs(limit, type);
  }
};

// ============================================================================
// DEVICE STATE ENDPOINTS
// ============================================================================

export const deviceAPI = {
  getDeviceState: async () => {
    const response = await api.get('/api/device-state');
    return response.data;
  }
};

export default api;
