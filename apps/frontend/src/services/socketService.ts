import React from 'react';
import { io, Socket } from 'socket.io-client';
import { EventType } from '@n8n-streamdeck/shared';

interface Event {
  type: EventType;
  data: any;
  timestamp: number;
}

interface SocketServiceOptions {
  url?: string;
  autoConnect?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  timeout?: number;
  batchSize?: number;
  batchDelay?: number;
}

interface EventBatch {
  events: Event[];
  timestamp: number;
}

export class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private eventQueue: Event[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectionDelay: number;
  private isConnecting = false;
  private eventListeners = new Map<string, Set<Function>>();
  private options: Required<SocketServiceOptions>;

  constructor(options: SocketServiceOptions = {}) {
    this.options = {
      url:
        options.url ||
        (typeof window !== 'undefined'
          ? window.location.origin
          : 'http://localhost:3001'),
      autoConnect: options.autoConnect ?? true,
      reconnectionAttempts: options.reconnectionAttempts ?? 5,
      reconnectionDelay: options.reconnectionDelay ?? 1000,
      timeout: options.timeout ?? 20000,
      batchSize: options.batchSize ?? 10,
      batchDelay: options.batchDelay ?? 100,
    };

    this.maxReconnectAttempts = this.options.reconnectionAttempts;
    this.reconnectionDelay = this.options.reconnectionDelay;

    if (this.options.autoConnect) {
      this.connect();
    }
  }

  static getInstance(options?: SocketServiceOptions): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService(options);
    }
    return SocketService.instance;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        // Wait for existing connection attempt
        const checkConnection = () => {
          if (this.socket?.connected) {
            resolve();
          } else if (!this.isConnecting) {
            reject(new Error('Connection failed'));
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
        return;
      }

      this.isConnecting = true;

      this.socket = io(this.options.url, {
        autoConnect: false,
        timeout: this.options.timeout,
        reconnection: false, // We handle reconnection manually
        transports: ['websocket', 'polling'],
      });

      this.setupEventListeners();

      const connectTimeout = setTimeout(() => {
        this.isConnecting = false;
        reject(new Error('Connection timeout'));
      }, this.options.timeout);

      this.socket.on('connect', () => {
        clearTimeout(connectTimeout);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        console.log('Socket connected');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(connectTimeout);
        this.isConnecting = false;
        console.error('Socket connection error:', error);
        this.handleReconnection();
        reject(error);
      });

      this.socket.connect();
    });
  }

  disconnect(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.eventQueue = [];
    console.log('Socket disconnected');
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect
        return;
      }
      this.handleReconnection();
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Handle batched events
    this.socket.on('events:batch', (batch: EventBatch) => {
      this.processBatchedEvents(batch);
    });

    // Handle individual events
    Object.values(EventType).forEach((eventType) => {
      this.socket!.on(eventType, (event: Event) => {
        this.handleEvent(eventType, event);
      });
    });
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay =
      this.reconnectionDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`
    );

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  private processBatchedEvents(batch: EventBatch): void {
    batch.events.forEach((event) => {
      this.handleEvent(event.type, event);
    });
  }

  private handleEvent(eventType: string, event: Event): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  // Event subscription with automatic cleanup
  on<T extends Event>(
    eventType: EventType,
    listener: (event: T) => void
  ): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }

    const listeners = this.eventListeners.get(eventType)!;
    listeners.add(listener);

    // Return cleanup function
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.eventListeners.delete(eventType);
      }
    };
  }

  off(eventType: EventType, listener?: Function): void {
    if (!listener) {
      this.eventListeners.delete(eventType);
      return;
    }

    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.eventListeners.delete(eventType);
      }
    }
  }

  // Emit events with batching for high-frequency events
  emit(eventType: EventType, data: any): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, event queued:', eventType);
      this.queueEvent({
        type: eventType,
        data,
        timestamp: Date.now(),
      } as Event);
      return;
    }

    // Check if this is a high-frequency event that should be batched
    const highFrequencyEvents = [EventType.BUTTON_PRESS];

    if (highFrequencyEvents.includes(eventType)) {
      this.queueEvent({
        type: eventType,
        data,
        timestamp: Date.now(),
      } as Event);
      this.scheduleBatchEmit();
    } else {
      this.socket.emit(eventType, data);
    }
  }

  private queueEvent(event: Event): void {
    this.eventQueue.push(event);

    // Prevent queue from growing too large
    if (this.eventQueue.length > this.options.batchSize * 5) {
      this.eventQueue = this.eventQueue.slice(-this.options.batchSize * 3);
    }
  }

  private scheduleBatchEmit(): void {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(() => {
      this.emitBatch();
      this.batchTimer = null;
    }, this.options.batchDelay);
  }

  private emitBatch(): void {
    if (this.eventQueue.length === 0 || !this.socket?.connected) return;

    const batch: EventBatch = {
      events: this.eventQueue.splice(0, this.options.batchSize),
      timestamp: Date.now(),
    };

    this.socket.emit('events:batch', batch);
  }

  // Connection status
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  get connectionState(): 'connected' | 'connecting' | 'disconnected' {
    if (this.socket?.connected) return 'connected';
    if (this.isConnecting) return 'connecting';
    return 'disconnected';
  }

  // Health check
  ping(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const startTime = Date.now();

      this.socket.emit('ping', startTime, (_response: number) => {
        const latency = Date.now() - startTime;
        resolve(latency);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Ping timeout'));
      }, 5000);
    });
  }

  // Memory cleanup
  cleanup(): void {
    this.disconnect();
    this.eventListeners.clear();
    this.eventQueue = [];
  }
}

// Singleton instance
export const socketService = SocketService.getInstance();

// React hook for socket connection
export function useSocket(options?: SocketServiceOptions) {
  const [socket] = React.useState(() => SocketService.getInstance(options));
  const [isConnected, setIsConnected] = React.useState(socket.isConnected);
  const [connectionState, setConnectionState] = React.useState(
    socket.connectionState
  );

  React.useEffect(() => {
    const checkConnection = () => {
      setIsConnected(socket.isConnected);
      setConnectionState(socket.connectionState);
    };

    const interval = setInterval(checkConnection, 1000);
    checkConnection();

    return () => {
      clearInterval(interval);
    };
  }, [socket]);

  React.useEffect(() => {
    return () => {
      // Cleanup on unmount
      socket.cleanup();
    };
  }, [socket]);

  return {
    socket,
    isConnected,
    connectionState,
    connect: () => socket.connect(),
    disconnect: () => socket.disconnect(),
    ping: () => socket.ping(),
  };
}

// Export for direct usage
export default socketService;
