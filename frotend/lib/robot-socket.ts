import type {
  BotRole,
  HornBeepCommand,
  MovementCommand,
  RobotClientEvent,
  RobotServerEvent,
  ServoCameraCommand,
  ServoSprayCommand,
  WaterRefillCommand,
  WaterSprayCommand,
} from "@/lib/robot-events";

export type RobotSocketEvent = RobotServerEvent;

type RobotSocketListener = (event: RobotSocketEvent) => void;
type ConnectionListener = (connected: boolean) => void;
type BinaryFrameListener = (frame: Blob) => void;

class RobotSocket {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private manuallyClosed = false;
  private readonly subscribedRobots = new Map<string, BotRole[]>();
  private readonly listeners = new Set<RobotSocketListener>();
  private readonly connectionListeners = new Set<ConnectionListener>();
  private readonly binaryListeners = new Set<BinaryFrameListener>();

  connect() {
    if (typeof window === "undefined") return;
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    this.manuallyClosed = false;
    void this._connectWithToken();
  }

  private async _connectWithToken() {
    // --------------------------------------------------
    // FETCH A SHORT-LIVED WS TOKEN
    //
    // The __session cookie is httpOnly — JavaScript
    // cannot read it with document.cookie.
    // We call /api/auth/ws-token which is proxied
    // through Next.js, so the cookie is sent correctly
    // server-side. The backend returns a 60s JWT we
    // can safely put in the URL as ?token=.
    // --------------------------------------------------

    let wsUrl: string;

    const baseUrl = process.env.NEXT_PUBLIC_WS_URL
      ?? "ws://localhost:5000";

    try {
      const res = await fetch("/api/auth/ws-token", {
        credentials: "include",
      });

      if (res.ok) {
        const json = await res.json() as { success: boolean; data: { token: string } };
        wsUrl = `${baseUrl}?token=${encodeURIComponent(json.data.token)}`;
        console.log("[RobotSocket] connecting with WS token");
      } else {
        // Not logged in or token fetch failed — connect anonymously.
        // robot:subscribe will be rejected by the server.
        wsUrl = baseUrl;
        console.warn("[RobotSocket] ws-token fetch failed (status", res.status, ") — connecting unauthenticated");
      }
    } catch (err) {
      wsUrl = baseUrl;
      console.warn("[RobotSocket] ws-token fetch error:", err, "— connecting unauthenticated");
    }

    // Guard: another connect() call may have raced us.
    if (this.manuallyClosed) return;
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const socket = new WebSocket(wsUrl);

    // Accept binary frames as Blobs for the camera stream.
    socket.binaryType = "blob";

    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) return;

      console.log("[RobotSocket] WebSocket OPEN", baseUrl);

      this.reconnectAttempts = 0;
      this.notifyConnectionChange(true);

      for (const [robotId, roles] of this.subscribedRobots) {
        console.log("[RobotSocket] re-subscribing robotId=", robotId, "roles=", roles);
        this.send({ type: "robot:subscribe", robotId, roles });
      }
    };

    socket.onmessage = (message) => {
      // Binary message = camera JPEG frame.
      if (message.data instanceof Blob) {
        this.binaryListeners.forEach((listener) => listener(message.data as Blob));
        return;
      }

      console.log("[RobotSocket] message from server:", message.data);

      try {
        const event = JSON.parse(message.data as string) as RobotSocketEvent;
        this.listeners.forEach((listener) => listener(event));
      } catch {
        // Ignore malformed messages.
      }
    };

    socket.onclose = () => {
      if (this.socket !== socket) return;

      this.socket = null;
      this.notifyConnectionChange(false);

      if (!this.manuallyClosed) {
        this.scheduleReconnect();
      }
    };
  }

  disconnect() {
    this.manuallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.notifyConnectionChange(false);
  }

  subscribe(robotId: string, roles: BotRole[]) {
    console.log("[RobotSocket] subscribe robotId=", robotId, "roles=", roles, "wsState=", this.socket?.readyState ?? null);
    this.subscribedRobots.set(robotId, roles);
    this.send({ type: "robot:subscribe", robotId, roles });
  }

  unsubscribe(robotId: string) {
    this.subscribedRobots.delete(robotId);
    this.send({ type: "robot:unsubscribe", robotId });
  }

  send(data: RobotClientEvent): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    this.socket.send(JSON.stringify(data));
    return true;
  }

  sendMovement(command: MovementCommand) {
    return this.send(command);
  }

  sendServoCameraCommand(command: ServoCameraCommand) {
    return this.send(command);
  }

  sendServoSprayCommand(command: ServoSprayCommand) {
    return this.send(command);
  }

  sendWaterRefillCommand(command: WaterRefillCommand) {
    return this.send(command);
  }

  sendWaterSprayCommand(command: WaterSprayCommand) {
    return this.send(command);
  }

  sendHornCommand(command: HornBeepCommand) {
    return this.send(command);
  }

  on(listener: RobotSocketListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onBinaryFrame(listener: BinaryFrameListener) {
    this.binaryListeners.add(listener);
    return () => {
      this.binaryListeners.delete(listener);
    };
  }

  onConnectionChange(listener: ConnectionListener) {
    this.connectionListeners.add(listener);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  get connected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  get socketReadyState(): number | null {
    return this.socket?.readyState ?? null;
  }

  private notifyConnectionChange(connected: boolean) {
    this.connectionListeners.forEach((listener) => listener(connected));
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

export const robotSocket = new RobotSocket();
