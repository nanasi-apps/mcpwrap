/**
 * mcpwrap - Type Definitions
 */

// OpenCode Config Types
export interface OpenCodeConfig {
  mcp?: Record<string, McpServerConfig>;
  [key: string]: unknown;
}

export interface McpServerConfig {
  type: "local" | "remote";
  enabled?: boolean;
  command?: string[];
  url?: string;
  oauth?: boolean | Record<string, unknown>;
  timeout?: number;
  headers?: Record<string, string>;
  env?: Record<string, string>;
}

// MCP Protocol Types
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, McpJsonSchemaProperty>;
    required?: string[];
  };
}

export interface McpJsonSchemaProperty {
  type: string;
  description?: string;
  items?: McpJsonSchemaProperty;
  properties?: Record<string, McpJsonSchemaProperty>;
  required?: string[];
  enum?: unknown[];
}

export interface McpToolCallResult {
  content: Array<{
    type: string;
    text?: string;
    data?: unknown;
  }>;
  isError?: boolean;
}

// CLI Response Types
export interface CliSuccessResponse {
  ok: true;
  server: string;
  action: string;
  tool?: string;
  result: unknown;
  meta: {
    duration_ms: number;
    transport?: string;
    exit_code: number;
  };
}

export interface CliErrorResponse {
  ok: false;
  server: string;
  action: string;
  tool?: string;
  error: {
    code: string;
    category: ErrorCategory;
    message: string;
    retryable: boolean;
    hint?: string;
    next_action?: {
      type: string;
      command?: string;
    };
  };
  meta: {
    duration_ms: number;
    transport?: string;
    exit_code: number;
  };
  stderr?: {
    summary: string;
    tail: string[];
    truncated: boolean;
  };
}

export type CliResponse = CliSuccessResponse | CliErrorResponse;

export type ErrorCategory =
  | "config"
  | "auth"
  | "transport"
  | "protocol"
  | "tool"
  | "init"
  | "internal";

// Transport Types
export interface Transport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendRequest(method: string, params?: unknown): Promise<unknown>;
}

// Auth Types
export interface AuthState {
  hasExistingAuth: boolean;
  token?: string;
  expiresAt?: Date;
}

// CLI Args Types
export interface ParsedArgs {
  config?: string;
  server?: string;
  command?: string;
  tool?: string;
  input?: string;
  inputFile?: string;
  outputDir?: string;
  skillName?: string;
  force?: boolean;
  dryRun?: boolean;
  debug?: boolean;
  interactive?: boolean;
  flags: Record<string, unknown>;
  help?: boolean;
}

export interface CliArgDefinition {
  name: string;
  aliases: string[];
  type: "string" | "integer" | "number" | "boolean" | "array" | "object";
  required: boolean;
  description?: string;
}

export type ToolRisk = "read" | "write" | "unknown";

export interface DiscoveredTool {
  name: string;
  description: string;
  category: string;
  risk: ToolRisk;
  inputSchema: McpTool["inputSchema"];
  requiredFields: string[];
  cliArgs: CliArgDefinition[];
  examples: {
    cli: string[];
    json: Record<string, unknown> | null;
  };
}

export interface InitOptions {
  outputDir: string;
  skillName: string;
  serverName: string;
  force: boolean;
  dryRun: boolean;
}

export interface InitErrorDetails {
  phase: string;
  tool?: string;
  file?: string;
}
