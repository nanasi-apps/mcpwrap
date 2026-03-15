#!/usr/bin/env node

import { join } from "node:path";
import {
  loadOpenCodeConfig,
  getMcpServers,
  getMcpServer,
  ConfigError,
  loadMcpAuth,
  getMcpAuthToken,
} from "./config/loader.js";
import { StdioTransport } from "./transport/stdio.js";
import { HttpTransport, HttpTransportError } from "./transport/http.js";
import {
  parseCliArgs,
  generateCliArgsFromSchema,
  convertFlagsToInput,
  validateRequiredArgs,
} from "./utils/args.js";
import type { McpServerConfig, McpTool, CliResponse, Transport } from "./types";
import { formatResponse, shouldUseHumanFormat } from "./utils/formatters.js";

const startTime = Date.now();

const GLOBAL_COMMANDS = ["list-servers"];

function debugLog(parsed: ReturnType<typeof parseCliArgs>, message: string): void {
  if (parsed.debug) {
    console.error(`[debug] ${message}`);
  }
}

function getOutputFormat(): "json" | "human" {
  return shouldUseHumanFormat() ? "human" : "json";
}

function outputResponse(response: CliResponse): void {
  console.log(formatResponse(response, getOutputFormat()));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsed = parseCliArgs(args);

  if (parsed.help || args.length === 0) {
    showHelp();
    process.exit(0);
  }

  // Handle global commands (no server prefix)
  const firstArg = args[0];
  if (GLOBAL_COMMANDS.includes(firstArg)) {
    parsed.command = firstArg;
  }

  // Shorthand: if --tool is provided without explicit command, treat as call
  const command = parsed.command ?? (parsed.tool ? "call" : "");

  if (!command) {
    handleError({
      ok: false,
      server: parsed.server ?? "",
      action: "",
      error: {
        code: "INTERNAL_ERROR",
        category: "internal",
        message: "No command specified",
        retryable: false,
        hint: "Use: list-servers, <server> list-tools, <server> describe --tool <name>, <server> call --tool <name>",
      },
      meta: {
        duration_ms: Date.now() - startTime,
        exit_code: 1,
      },
    });
    return;
  }

  debugLog(parsed, `config_path=${parsed.config ?? "~/.config/opencode/opencode.json"}`);
  debugLog(parsed, `server=${parsed.server ?? "(none)"}`);
  debugLog(parsed, `command=${command}`);
  if (parsed.tool) {
    debugLog(parsed, `tool=${parsed.tool}`);
  }

  try {
    await handleCommand(command, parsed);
  } catch (error) {
    handleError(buildErrorResponse(error, parsed));
  }
}

async function handleCommand(
  command: string,
  parsed: ReturnType<typeof parseCliArgs>,
): Promise<void> {
  switch (command) {
    case "list-servers":
      await handleListServers(parsed);
      break;
    case "list-tools":
      await handleListTools(parsed);
      break;
    case "describe":
      await handleDescribe(parsed);
      break;
    case "call":
      await handleCall(parsed);
      break;
    case "init":
      await handleInit(parsed);
      break;
    default:
      handleError({
        ok: false,
        server: parsed.server ?? "",
        action: command,
        error: {
          code: "INTERNAL_ERROR",
          category: "internal",
          message: `Unknown command: ${command}`,
          retryable: false,
          hint: "Use: list-servers, list-tools, describe, call, init",
        },
        meta: {
          duration_ms: Date.now() - startTime,
          exit_code: 1,
        },
      });
  }
}

function showHelp(): void {
  console.log(`
Usage: mcpwrap <command> [options]

Commands:
  list-servers                    List all configured MCP servers
  <server> list-tools             List tools from a server
  <server> describe --tool <name> Describe a tool
  <server> call --tool <name>    Call a tool with arguments
  <server> init [--output-dir <dir>] --skill-name <name>
                                  Generate AgentSkills template (prompts if --output-dir omitted)

Global Options:
  --config <path>                Path to OpenCode config file
  --debug                        Enable debug mode
  --help, -h                     Show this help

Call Options:
  --tool <name>                  Tool name to call
  --input <json>                 JSON input string
  --input-file <path>            JSON input from file
  --flag <value>                 Tool-specific arguments
`);
}

async function handleListServers(parsed: ReturnType<typeof parseCliArgs>): Promise<void> {
  const config = loadOpenCodeConfig(parsed.config);
  const servers = getMcpServers(config);

  const result = Object.entries(servers).map(([name, server]) => {
    const srv = server as McpServerConfig;
    return {
      name,
      type: srv.type,
      enabled: srv.enabled ?? true,
      url: srv.url,
      oauth: srv.oauth ? true : false,
    };
  });

  const response: CliResponse = {
    ok: true,
    server: "",
    action: "list-servers",
    result,
    meta: {
      duration_ms: Date.now() - startTime,
      exit_code: 0,
    },
  };

  outputResponse(response);
}

async function handleListTools(parsed: ReturnType<typeof parseCliArgs>): Promise<void> {
  if (!parsed.server) {
    throw new Error("Server name is required");
  }

  const config = loadOpenCodeConfig(parsed.config);
  const serverConfig = getMcpServer(config, parsed.server);

  if (!serverConfig) {
    throw new Error(`Server not found: ${parsed.server}`);
  }

  if (serverConfig.enabled === false) {
    throw new Error(`Server is disabled: ${parsed.server}`);
  }

  const authStore = loadMcpAuth();
  const transport = createTransport(serverConfig, parsed.server, authStore, parsed);
  await transport.connect();

  try {
    const result = (await transport.sendRequest("tools/list")) as {
      tools: McpTool[];
    };

    const response: CliResponse = {
      ok: true,
      server: parsed.server,
      action: "list-tools",
      result: result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
      meta: {
        duration_ms: Date.now() - startTime,
        transport: serverConfig.type,
        exit_code: 0,
      },
    };

    outputResponse(response);
  } finally {
    await transport.disconnect();
  }
}

async function handleDescribe(parsed: ReturnType<typeof parseCliArgs>): Promise<void> {
  if (!parsed.server) {
    throw new Error("Server name is required");
  }

  if (!parsed.tool) {
    throw new Error("Tool name is required (--tool)");
  }

  const config = loadOpenCodeConfig(parsed.config);
  const serverConfig = getMcpServer(config, parsed.server);

  if (!serverConfig) {
    throw new Error(`Server not found: ${parsed.server}`);
  }

  const authStore = loadMcpAuth();
  const transport = createTransport(serverConfig, parsed.server, authStore, parsed);
  await transport.connect();

  try {
    const result = (await transport.sendRequest("tools/list")) as {
      tools: McpTool[];
    };

    const tool = result.tools.find((t) => t.name === parsed.tool);
    if (!tool) {
      throw new Error(`Tool not found: ${parsed.tool}`);
    }

    const cliArgs = generateCliArgsFromSchema(tool);

    const response: CliResponse = {
      ok: true,
      server: parsed.server,
      action: "describe",
      tool: parsed.tool,
      result: {
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
        cli_args: cliArgs,
      },
      meta: {
        duration_ms: Date.now() - startTime,
        transport: serverConfig.type,
        exit_code: 0,
      },
    };

    outputResponse(response);
  } finally {
    await transport.disconnect();
  }
}

function findSimilarTool(input: string, available: string[]): string | undefined {
  const inputLower = input.toLowerCase();

  const exactMatch = available.find((t) => t.toLowerCase() === inputLower);
  if (exactMatch) return exactMatch;

  const containsMatch = available.find(
    (t) => t.toLowerCase().includes(inputLower) || inputLower.includes(t.toLowerCase()),
  );
  if (containsMatch) return containsMatch;

  let bestMatch: string | undefined;
  let bestDistance = Infinity;

  for (const tool of available) {
    const distance = levenshteinDistance(inputLower, tool.toLowerCase());
    if (distance < bestDistance && distance <= 3) {
      bestDistance = distance;
      bestMatch = tool;
    }
  }

  return bestMatch;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

async function handleCall(parsed: ReturnType<typeof parseCliArgs>): Promise<void> {
  if (!parsed.server) {
    throw new Error("Server name is required");
  }

  if (!parsed.tool) {
    const error = new Error("Tool name is required (--tool)") as Error & {
      code?: string;
      hint?: string;
    };
    error.code = "TOOL_NAME_REQUIRED";
    error.hint = `Use: mcpwrap ${parsed.server} list-tools to see available tools`;
    throw error;
  }

  const config = loadOpenCodeConfig(parsed.config);
  const serverConfig = getMcpServer(config, parsed.server);

  if (!serverConfig) {
    throw new Error(`Server not found: ${parsed.server}`);
  }

  const authStore = loadMcpAuth();
  const transport = createTransport(serverConfig, parsed.server, authStore, parsed);
  await transport.connect();

  try {
    const listResult = (await transport.sendRequest("tools/list")) as {
      tools: McpTool[];
    };

    const tool = listResult.tools.find((t) => t.name === parsed.tool);
    if (!tool) {
      const availableTools = listResult.tools.map((t) => t.name);
      const suggestion = findSimilarTool(parsed.tool, availableTools);

      let hint = `Use: mcpwrap ${parsed.server} list-tools to see available tools`;
      if (suggestion) {
        hint = `Did you mean '${suggestion}'?\n${hint}`;
      }

      const error = new Error(`Tool not found: ${parsed.tool}`) as Error & {
        code?: string;
        hint?: string;
      };
      error.code = "TOOL_NOT_FOUND";
      error.hint = hint;
      throw error;
    }

    let input: Record<string, unknown>;

    if (parsed.input) {
      input = JSON.parse(parsed.input);
    } else if (parsed.inputFile) {
      const { readFileSync } = await import("node:fs");
      input = JSON.parse(readFileSync(parsed.inputFile, "utf-8"));
    } else {
      input = convertFlagsToInput(parsed.flags, tool.inputSchema);
    }

    const missing = validateRequiredArgs(input, tool.inputSchema);
    if (missing.length > 0) {
      throw new Error(`Missing required arguments: ${missing.join(", ")}`);
    }

    const result = await transport.sendRequest("tools/call", {
      name: parsed.tool,
      arguments: input,
    });

    const response: CliResponse = {
      ok: true,
      server: parsed.server,
      action: "call",
      tool: parsed.tool,
      result,
      meta: {
        duration_ms: Date.now() - startTime,
        transport: serverConfig.type,
        exit_code: 0,
      },
    };

    outputResponse(response);
  } finally {
    await transport.disconnect();
  }
}

async function handleInit(parsed: ReturnType<typeof parseCliArgs>): Promise<void> {
  if (!parsed.server) {
    throw new Error("Server name is required");
  }

  let baseDir: string;

  if (!parsed.outputDir) {
    const { promptForLocation } = await import("./utils/location.js");
    const location = await promptForLocation();
    baseDir = location.path;
  } else {
    baseDir = parsed.outputDir;
  }

  const skillName = parsed.skillName ?? parsed.server;
  const outputDir = join(baseDir, skillName);

  const config = loadOpenCodeConfig(parsed.config);
  const serverConfig = getMcpServer(config, parsed.server);

  if (!serverConfig) {
    throw new Error(`Server not found: ${parsed.server}`);
  }

  const authStore = loadMcpAuth();
  const transport = createTransport(serverConfig, parsed.server, authStore, parsed);
  await transport.connect();

  try {
    const listResult = (await transport.sendRequest("tools/list")) as {
      tools: McpTool[];
    };

    const { generateSkillTemplate } = await import("./utils/init.js");

    const initOptions = {
      outputDir,
      skillName,
      serverName: parsed.server,
      force: parsed.force ?? false,
      dryRun: parsed.dryRun ?? false,
    };

    const initResult = generateSkillTemplate(initOptions, listResult.tools);

    const resultFiles: Record<string, unknown> = {
      output_dir: initResult.outputDir,
      skill_name: initResult.skillName,
      tool_count: initResult.toolCount,
      categories: initResult.categories,
      files_written: initResult.filesWritten,
    };

    if (initResult.dryRun) {
      resultFiles.dry_run = true;
    }

    const response: CliResponse = {
      ok: true,
      server: parsed.server,
      action: "init",
      result: resultFiles,
      meta: {
        duration_ms: Date.now() - startTime,
        transport: serverConfig.type,
        exit_code: 0,
      },
    };

    outputResponse(response);
  } finally {
    await transport.disconnect();
  }
}

function createTransport(
  serverConfig: McpServerConfig,
  serverName: string,
  authStore: ReturnType<typeof loadMcpAuth>,
  parsed: ReturnType<typeof parseCliArgs>,
): Transport {
  if (serverConfig.type === "local") {
    if (!serverConfig.command || serverConfig.command.length === 0) {
      throw new Error("Local server requires command configuration");
    }
    const [cmd, ...cmdArgs] = serverConfig.command;
    return new StdioTransport(cmd, cmdArgs, serverConfig.env);
  } else {
    if (!serverConfig.url) {
      throw new Error("Remote server requires URL configuration");
    }

    const headers: Record<string, string> = {};
    if (serverConfig.headers) {
      for (const [key, headerValue] of Object.entries(serverConfig.headers)) {
        const value = headerValue as string;
        if (value.startsWith("{env:") && value.endsWith("}")) {
          const envVar = value.slice(5, -1);
          const envValue = process.env[envVar];
          if (envValue) {
            headers[key] = envValue;
          }
        } else {
          headers[key] = value;
        }
      }
    }

    // Check for OAuth token in auth store
    const authToken = getMcpAuthToken(authStore, serverName);
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
      debugLog(parsed, `auth_check=token_found server=${serverName}`);
    } else if (serverConfig.oauth) {
      debugLog(parsed, `auth_check=no_token server=${serverName}`);
    }

    return new HttpTransport(serverConfig.url, serverConfig.timeout, headers);
  }
}

function handleError(response: CliResponse): void {
  console.log(formatResponse(response, getOutputFormat()));
  process.exit(response.meta.exit_code);
}

function buildErrorResponse(error: unknown, parsed: ReturnType<typeof parseCliArgs>): CliResponse {
  const duration = Date.now() - startTime;

  const err = error as Error;
  const message = err instanceof Error ? err.message : String(error);

  const stderrInfo = {
    summary: message,
    tail: [] as string[],
    truncated: false,
  };

  if (parsed.debug && err instanceof Error && err.stack) {
    stderrInfo.tail = err.stack.split("\n").slice(0, 5);
  }

  if (error instanceof ConfigError) {
    return {
      ok: false,
      server: parsed.server ?? "",
      action: parsed.command ?? "",
      tool: parsed.tool,
      error: {
        code: error.code,
        category: "config",
        message: error.message,
        retryable: false,
        hint: error.context?.hint,
      },
      meta: {
        duration_ms: duration,
        exit_code: 1,
      },
      stderr: stderrInfo,
    };
  }

  if (error instanceof HttpTransportError) {
    let category: "transport" | "auth" = "transport";
    let code = "TRANSPORT_CONNECT_FAILED";
    let hint: string | undefined;

    if (error.statusCode === 401) {
      category = "auth";
      code = "AUTH_REQUIRED";
      hint = "Run: opencode mcp auth <server>";
    } else if (error.statusCode === 408) {
      code = "TRANSPORT_TIMEOUT";
    }

    return {
      ok: false,
      server: parsed.server ?? "",
      action: parsed.command ?? "",
      tool: parsed.tool,
      error: {
        code,
        category,
        message: error.message,
        retryable: true,
        hint,
      },
      meta: {
        duration_ms: duration,
        exit_code: 1,
      },
      stderr: stderrInfo,
    };
  }

  const customError = error as Error & { code?: string; hint?: string };
  const code = customError.code ?? "INTERNAL_ERROR";
  const hint = customError.hint;
  const category = code.startsWith("TOOL_") ? "tool" : "internal";

  return {
    ok: false,
    server: parsed.server ?? "",
    action: parsed.command ?? "",
    tool: parsed.tool,
    error: {
      code,
      category,
      message,
      retryable: false,
      hint,
    },
    meta: {
      duration_ms: duration,
      exit_code: 1,
    },
    stderr: stderrInfo,
  };
}

void (async () => {
  await main();
})();
