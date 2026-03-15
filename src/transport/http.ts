import type { Transport } from "../types/index.js";

interface JsonRpcResponse {
  result?: unknown;
  error?: { code: number; message: string };
}

export class HttpTransport implements Transport {
  private url: string;
  private timeout: number;
  private headers: Record<string, string>;
  private sessionId: string | undefined;

  constructor(url: string, timeout: number = 30000, headers: Record<string, string> = {}) {
    this.url = url;
    this.timeout = timeout;
    this.headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    };
  }

  async connect(): Promise<void> {
    await this.initializeSession();
  }

  async disconnect(): Promise<void> {
    this.sessionId = undefined;
  }

  private parseSseData(text: string): unknown {
    const lines = text.split("\n");
    let data = "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        data += line.slice(6);
      }
    }
    return data ? JSON.parse(data) : null;
  }

  private async initializeSession(): Promise<void> {
    const initRequest = {
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "mcpwrap",
          version: "0.0.0",
        },
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(initRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new HttpTransportError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
        );
      }

      const sessionId = response.headers.get("mcp-session-id");
      if (sessionId) {
        this.sessionId = sessionId;
      }

      const contentType = response.headers.get("content-type") ?? "";
      let result: JsonRpcResponse;

      if (contentType.includes("text/event-stream")) {
        const text = await response.text();
        result = this.parseSseData(text) as JsonRpcResponse;
      } else {
        result = (await response.json()) as JsonRpcResponse;
      }

      if (result?.error) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      if (error instanceof HttpTransportError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new HttpTransportError("Request timeout", 408);
      }
      throw new HttpTransportError(String(error), 0);
    }
  }

  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    const requestBody = {
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params,
    };

    const headers = { ...this.headers };
    if (this.sessionId) {
      headers["mcp-session-id"] = this.sessionId;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new HttpTransportError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      let result: JsonRpcResponse;

      if (contentType.includes("text/event-stream")) {
        const text = await response.text();
        result = this.parseSseData(text) as JsonRpcResponse;
      } else {
        result = (await response.json()) as JsonRpcResponse;
      }

      if (result?.error) {
        throw new Error(result.error.message);
      }

      return result?.result;
    } catch (error) {
      if (error instanceof HttpTransportError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new HttpTransportError("Request timeout", 408);
      }
      throw new HttpTransportError(String(error), 0);
    }
  }

  setHeader(key: string, value: string): void {
    this.headers[key] = value;
  }
}

export class HttpTransportError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "HttpTransportError";
    this.statusCode = statusCode;
  }
}
