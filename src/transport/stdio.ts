import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Transport } from "../types/index.ts";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

interface JsonRpcMessage {
  id?: string;
  result?: unknown;
  error?: { code: number; message: string };
}

export class StdioTransport implements Transport {
  private process: ReturnType<typeof spawn> | undefined;
  private pendingRequests: Map<string, PendingRequest>;
  private buffer: string;
  private command: string;
  private args: string[];
  private env: Record<string, string>;

  constructor(command: string, args: string[], env: Record<string, string> = {}) {
    this.command = command;
    this.args = args;
    this.env = env;
    this.pendingRequests = new Map();
    this.buffer = "";
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = 5000;
      const startTime = Date.now();
      let isResolved = false;

      this.process = spawn(this.command, this.args, {
        env: { ...process.env, ...this.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      const checkReady = () => {
        if (isResolved) return;

        if (this.process && this.process.stdin?.writable) {
          isResolved = true;
          resolve();
          return;
        }

        if (Date.now() - startTime > timeout) {
          isResolved = true;
          this.process?.kill();
          reject(new Error(`Process initialization timeout after ${timeout}ms`));
          return;
        }

        setImmediate(checkReady);
      };

      this.process.stdout?.on("data", (data: Buffer) => {
        this.handleData(data.toString());
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        console.error("[stderr]", data.toString());
      });

      this.process.on("error", (error: Error) => {
        if (!isResolved) {
          isResolved = true;
          reject(new Error(`Failed to spawn process: ${error.message}`));
        }
      });

      this.process.on("close", (code: number | null) => {
        if (code !== 0 && code !== null) {
          console.error(`Process exited with code ${code}`);
        }
      });

      checkReady();
    });
  }

  async disconnect(): Promise<void> {
    this.process?.kill();
    this.process = undefined;
  }

  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const timeout = 30000;
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(id, {
        resolve: (value: unknown) => {
          clearTimeout(timeoutId);
          resolve(value);
        },
        reject: (reason: Error) => {
          clearTimeout(timeoutId);
          reject(reason);
        },
      });

      const request = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      const requestJson = JSON.stringify(request);
      this.process?.stdin?.write(requestJson + "\n");
    });
  }

  private handleData(data: string): void {
    this.buffer += data;

    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.trim()) {
        this.handleMessage(line);
      }
    }
  }

  private handleMessage(line: string): void {
    try {
      const message = JSON.parse(line) as JsonRpcMessage;

      if (message.id) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          this.pendingRequests.delete(message.id);
          if (message.error) {
            pending.reject(new Error(message.error.message));
          } else {
            pending.resolve(message.result);
          }
        }
      }
    } catch (error) {
      console.error(
        "[warn] Failed to parse message:",
        line,
        "Error:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
