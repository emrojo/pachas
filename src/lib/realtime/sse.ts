/**
 * Pachas Realtime Server-Sent Events (SSE) Hub
 * 
 * Provides instantaneous real-time event distribution to connected browsers and mobile clients.
 * Supports cross-process sync using PostgreSQL LISTEN/NOTIFY, allowing transparent multi-instance
 * scaling (e.g. PM2 cluster, Docker, multi-core Node runtime).
 */

import { Client } from 'pg';
import { getDbPool, parseDatabaseConfig } from '@/lib/db/postgres';

export type RealtimeEventType =
  | 'group_message_created'
  | 'group_message_reaction'
  | 'group_message_deleted'
  | 'notification_created'
  | 'ping';

export interface RealtimeEvent<T = any> {
  id: string;
  type: RealtimeEventType;
  groupId?: string;
  userId?: string; // target user ID or author ID
  payload: T;
  timestamp: string;
  sourceProcessId?: string;
}

export interface SSEClient {
  id: string;
  userId?: string;
  groupId?: string;
  send: (formattedData: string) => void;
  close: () => void;
}

const PROCESS_ID = Math.random().toString(36).substring(2, 9);
const PG_CHANNEL = 'pachas_realtime';

class RealtimeHub {
  private clients = new Set<SSEClient>();
  private pgListenerClient: Client | null = null;
  private isListeningPg = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
    this.initPostgresListener().catch(() => {});
  }

  /**
   * Register a new SSE client
   */
  public registerClient(client: SSEClient): () => void {
    this.clients.add(client);

    // Return cleanup function
    return () => {
      this.unregisterClient(client);
    };
  }

  /**
   * Unregister an SSE client
   */
  public unregisterClient(client: SSEClient): void {
    this.clients.delete(client);
  }

  /**
   * Get total active client connections in this process
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Broadcast an event to connected clients.
   * If not from remote, notifies other processes through PostgreSQL LISTEN/NOTIFY.
   */
  public async broadcast<T>(
    event: Omit<RealtimeEvent<T>, 'id' | 'timestamp' | 'sourceProcessId'>,
    fromRemote = false
  ): Promise<void> {
    const fullEvent: RealtimeEvent<T> = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      sourceProcessId: PROCESS_ID,
    };

    const sseFormatted = `id: ${fullEvent.id}\nevent: message\ndata: ${JSON.stringify(fullEvent)}\n\n`;

    // 1. Dispatch to matching local clients
    for (const client of this.clients) {
      try {
        let shouldDeliver = false;

        // If event targets a specific group, deliver to clients watching this group or listening to all
        if (fullEvent.groupId) {
          if (!client.groupId || client.groupId === fullEvent.groupId) {
            shouldDeliver = true;
          }
        } else if (fullEvent.userId) {
          // If event targets a specific user
          if (!client.userId || client.userId === fullEvent.userId) {
            shouldDeliver = true;
          }
        } else {
          // Global event
          shouldDeliver = true;
        }

        if (shouldDeliver) {
          client.send(sseFormatted);
        }
      } catch (err) {
        console.warn('Error sending SSE to client:', err);
      }
    }

    // 2. Propagate to other cluster processes via Postgres NOTIFY if originated locally
    if (!fromRemote) {
      const pool = getDbPool();
      if (pool) {
        try {
          const payloadStr = JSON.stringify(fullEvent);
          // Postgres NOTIFY payload limit is 8000 bytes
          if (payloadStr.length < 7800) {
            await pool.query('SELECT pg_notify($1, $2)', [PG_CHANNEL, payloadStr]);
          } else {
            // Trim large payload if needed or notify metadata only
            const lightEvent = { ...fullEvent, payload: { isTruncated: true, type: fullEvent.type } };
            await pool.query('SELECT pg_notify($1, $2)', [PG_CHANNEL, JSON.stringify(lightEvent)]);
          }
        } catch (pgErr) {
          // Ignore non-fatal pg_notify errors
        }
      }
    }
  }

  /**
   * Heartbeat to keep HTTP connections alive across NATs, proxies, and mobile cellular radios
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      if (this.clients.size === 0) return;
      const pingMessage = `: ping\n\n`;
      for (const client of this.clients) {
        try {
          client.send(pingMessage);
        } catch {
          this.clients.delete(client);
        }
      }
    }, 25000);
  }

  /**
   * Initializes persistent PostgreSQL LISTEN connection for cluster sync
   */
  private async initPostgresListener(): Promise<void> {
    if (this.isListeningPg) return;

    const config = parseDatabaseConfig();
    if (!config) return;

    try {
      const client = new Client(config);
      await client.connect();

      client.on('notification', (msg) => {
        if (msg.channel === PG_CHANNEL && msg.payload) {
          try {
            const parsedEvent = JSON.parse(msg.payload) as RealtimeEvent;
            // Ignore events sent by this same process
            if (parsedEvent.sourceProcessId !== PROCESS_ID) {
              this.broadcast(parsedEvent, true);
            }
          } catch (parseErr) {
            console.warn('Error parsing pg_notify payload:', parseErr);
          }
        }
      });

      client.on('error', (err) => {
        console.warn('PG Realtime Listener connection error:', err.message);
        this.reconnectPgListener();
      });

      client.on('end', () => {
        this.reconnectPgListener();
      });

      await client.query(`LISTEN ${PG_CHANNEL}`);
      this.pgListenerClient = client;
      this.isListeningPg = true;
    } catch (connErr: any) {
      // Database might not be available or server is running in offline/demo mode
      this.reconnectPgListener();
    }
  }

  private reconnectPgListener(): void {
    this.isListeningPg = false;
    if (this.pgListenerClient) {
      try {
        this.pgListenerClient.end().catch(() => {});
      } catch {}
        this.pgListenerClient = null;
    }

    setTimeout(() => {
      this.initPostgresListener().catch(() => {});
    }, 5000);
  }
}

// Global singleton across hot reloads
const globalRealtime = globalThis as unknown as { __pachas_realtime_hub__?: RealtimeHub };

export const realtimeHub = globalRealtime.__pachas_realtime_hub__ || new RealtimeHub();
if (process.env.NODE_ENV !== 'production') {
  globalRealtime.__pachas_realtime_hub__ = realtimeHub;
}
