import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { OpenCodeConfig, McpServerConfig } from "../types/index.ts";

const CONFIG_PATHS = [
  join(homedir(), ".config", "opencode", "opencode.json"),
  join(homedir(), ".config", "opencode", "opencode.jsonc"),
];

export function loadOpenCodeConfig(customPath: string | undefined): OpenCodeConfig {
  const configPath = customPath ?? findConfigPath();

  if (!configPath) {
    throw new ConfigError("CONFIG_NOT_FOUND", "OpenCode config file not found", {
      hint: `Checked: ${CONFIG_PATHS.join(", ")}`,
    });
  }

  if (!existsSync(configPath)) {
    throw new ConfigError("CONFIG_NOT_FOUND", `Config file not found: ${configPath}`);
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const jsonContent = stripJsonComments(content);
    const config = JSON.parse(jsonContent) as OpenCodeConfig;
    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ConfigError("CONFIG_INVALID", `Failed to parse config: ${error.message}`);
    }
    throw new ConfigError("CONFIG_INVALID", `Failed to load config: ${String(error)}`);
  }
}

function findConfigPath(): string | undefined {
  for (const path of CONFIG_PATHS) {
    if (existsSync(path)) {
      return path;
    }
  }
  return undefined;
}

function stripJsonComments(content: string): string {
  let result = content.replace(/(^|\s|[,;{}[\]])\/\/[^\n]*/g, "$1");
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");
  result = result.replace(/,(\s*[}\]])/g, "$1");
  return result;
}

export function getMcpServers(config: OpenCodeConfig): Record<string, McpServerConfig> {
  return config.mcp ?? {};
}

export function getMcpServer(
  config: OpenCodeConfig,
  serverName: string,
): McpServerConfig | undefined {
  return config.mcp?.[serverName];
}

export class ConfigError extends Error {
  code: string;
  context?: Record<string, string>;

  constructor(code: string, message: string, context?: Record<string, string>) {
    super(message);
    this.name = "ConfigError";
    this.code = code;
    this.context = context;
  }
}

export interface McpAuthEntry {
  oauthState?: string;
  clientInfo?: {
    clientId: string;
    clientIdIssuedAt: number;
  };
  serverUrl?: string;
  tokens?: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    scope?: string;
  };
}

export interface McpAuthStore {
  [serverName: string]: McpAuthEntry;
}

export function loadMcpAuth(): McpAuthStore {
  const authPath = join(homedir(), ".local", "share", "opencode", "mcp-auth.json");

  if (!existsSync(authPath)) {
    return {};
  }

  try {
    const content = readFileSync(authPath, "utf-8");
    return JSON.parse(content) as McpAuthStore;
  } catch (error) {
    console.warn(
      `[warn] Failed to load MCP auth from ${authPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return {};
  }
}

export function getMcpAuthToken(authStore: McpAuthStore, serverName: string): string | undefined {
  const entry = authStore[serverName];
  if (!entry?.tokens?.accessToken) {
    return undefined;
  }

  if (entry.tokens.expiresAt && entry.tokens.expiresAt * 1000 < Date.now()) {
    return undefined;
  }

  return entry.tokens.accessToken;
}
