import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
  createElement,
} from "react";
import { getToken } from "./auth";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WsEventType = "NEW_MESSAGE" | "NEW_NOTIFICATION";
export type WsEventCallback = (payload: unknown) => void;

interface WsContextValue {
  isConnected: boolean;
  subscribe: (event: WsEventType, cb: WsEventCallback) => () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WsContext = createContext<WsContextValue>({
  isConnected: false,
  subscribe: () => () => {},
});

// ─── Derive WebSocket URL ─────────────────────────────────────────────────────
// In dev: Vite proxies /ws → API server (port 8080).
// In prod: same origin as the page.

function getWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WsProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  // listeners: event → Set of callbacks
  const listeners = useRef(new Map<WsEventType, Set<WsEventCallback>>());

  const dispatch = useCallback((event: WsEventType, payload: unknown) => {
    listeners.current.get(event)?.forEach((cb) => cb(payload));
  }, []);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) return;

    const url = getWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send auth frame immediately after connection
      ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (event) => {
      let msg: { type: string; payload?: unknown; userId?: number };
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }

      if (msg.type === "authenticated") {
        if (isMounted.current) setIsConnected(true);
        return;
      }

      if (msg.type === "NEW_MESSAGE" || msg.type === "NEW_NOTIFICATION") {
        dispatch(msg.type, msg.payload);
      }
    };

    ws.onclose = () => {
      if (!isMounted.current) return;
      setIsConnected(false);
      // Auto-reconnect after 4 seconds
      reconnectTimer.current = setTimeout(() => {
        if (isMounted.current) connect();
      }, 4_000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [dispatch]);

  useEffect(() => {
    isMounted.current = true;
    connect();

    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const subscribe = useCallback(
    (event: WsEventType, cb: WsEventCallback): (() => void) => {
      if (!listeners.current.has(event)) {
        listeners.current.set(event, new Set());
      }
      listeners.current.get(event)!.add(cb);
      return () => {
        listeners.current.get(event)?.delete(cb);
      };
    },
    [],
  );

  return createElement(WsContext.Provider, { value: { isConnected, subscribe } }, children);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWs(): WsContextValue {
  return useContext(WsContext);
}
