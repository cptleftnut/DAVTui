import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export const useWebSocket = (url: string = 'http://localhost:3001') => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const newSocket = io(url, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      setConnected(true);
      setError(null);
      console.log('WebSocket connected');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('error', (err) => {
      setError(err.message || 'WebSocket error');
      console.error('WebSocket error:', err);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [url]);

  const emit = useCallback((event: string, data?: any) => {
    if (socket && connected) {
      socket.emit(event, data);
    }
  }, [socket, connected]);

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    if (socket) {
      socket.on(event, callback);
    }
  }, [socket]);

  const off = useCallback((event: string, callback?: (...args: any[]) => void) => {
    if (socket) {
      socket.off(event, callback);
    }
  }, [socket]);

  return { socket, connected, error, emit, on, off };
};

export const useSocketListener = (
  socket: Socket | null,
  event: string,
  callback: (...args: any[]) => void
) => {
  useEffect(() => {
    if (socket) {
      socket.on(event, callback);
      return () => {
        socket.off(event, callback);
      };
    }
  }, [socket, event, callback]);
};
