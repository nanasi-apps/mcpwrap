import { execSync } from "node:child_process";
import type { CliResponse, CliSuccessResponse, CliErrorResponse } from "../types/index.js";

export type OutputFormat = "json" | "human";

const AI_PATTERNS = [
  /opencode/i,
  /cursor/i,
  /claude/i,
  /aider/i,
  /copilot/i,
  /codeium/i,
  /tabnine/i,
];

function getParentProcessName(): string {
  try {
    const ppid = process.ppid;
    return execSync(`ps -p ${ppid} -o comm=`, { encoding: "utf-8", timeout: 100 }).trim();
  } catch {
    return "";
  }
}

function isAiExecution(): boolean {
  const parentName = getParentProcessName();
  return AI_PATTERNS.some((pattern) => pattern.test(parentName));
}

export function shouldUseHumanFormat(format?: string): boolean {
  if (format === "human") return true;
  if (format === "json") return false;
  if (isAiExecution()) return false;
  return process.stdout.isTTY ?? false;
}

export function formatResponse(response: CliResponse, format: OutputFormat): string {
  if (format === "json") {
    return JSON.stringify(response, null, 2);
  }

  if (!response.ok) {
    return formatError(response);
  }

  switch (response.action) {
    case "list-servers":
      return formatListServers(response);
    case "list-tools":
      return formatListTools(response);
    case "describe":
      return formatDescribe(response);
    case "call":
      return formatCall(response);
    case "init":
      return formatInit(response);
    default:
      return JSON.stringify(response.result, null, 2);
  }
}

function formatError(response: CliErrorResponse): string {
  const lines: string[] = [];

  lines.push(`❌ Error: ${response.error.message}`);
  lines.push("");
  lines.push(`Code: ${response.error.code}`);
  lines.push(`Category: ${response.error.category}`);

  if (response.error.hint) {
    lines.push("");
    lines.push(`💡 Hint: ${response.error.hint}`);
  }

  if (response.error.next_action) {
    lines.push("");
    lines.push(`Next action: ${response.error.next_action.type}`);
    if (response.error.next_action.command) {
      lines.push(`  Command: ${response.error.next_action.command}`);
    }
  }

  lines.push("");
  lines.push(`⏱️  Duration: ${response.meta.duration_ms}ms`);

  return lines.join("\n");
}

function formatListServers(response: CliSuccessResponse): string {
  const servers = response.result as Array<{
    name: string;
    type: string;
    enabled: boolean;
    url?: string;
    oauth: boolean;
  }>;

  if (servers.length === 0) {
    return "No MCP servers configured.\n\nUse opencode.json to add servers.";
  }

  const lines: string[] = [];
  lines.push(`📦 Configured MCP Servers (${servers.length})`);
  lines.push("");

  const maxNameLength = Math.max(...servers.map((s) => s.name.length));

  for (const server of servers) {
    const status = server.enabled ? "🟢" : "⚪";
    const name = server.name.padEnd(maxNameLength);
    const type = server.type.padEnd(7);
    const auth = server.oauth ? "🔐" : "  ";
    const url = server.url ? ` ${server.url}` : "";

    lines.push(`${status} ${name}  ${type}${auth}${url}`);
  }

  lines.push("");
  lines.push("Legend: 🟢 enabled | ⚪ disabled | 🔐 OAuth required");
  lines.push("");
  lines.push(`⏱️  Duration: ${response.meta.duration_ms}ms`);

  return lines.join("\n");
}

function formatListTools(response: CliSuccessResponse): string {
  const tools = response.result as Array<{
    name: string;
    description?: string;
  }>;

  if (tools.length === 0) {
    return "No tools available from this server.";
  }

  const lines: string[] = [];
  lines.push(`🛠️  Available Tools (${tools.length})`);
  lines.push("");
  lines.push(`Server: ${response.server}`);
  lines.push("");

  // Group by category-like prefixes
  const grouped = groupToolsByPrefix(tools);

  for (const [group, groupTools] of grouped) {
    if (group) {
      lines.push(`${group}:`);
    }

    for (const tool of groupTools) {
      const description = tool.description
        ? ` - ${tool.description.slice(0, 60)}${tool.description.length > 60 ? "..." : ""}`
        : "";
      lines.push(`  • ${tool.name}${description}`);
    }

    lines.push("");
  }

  lines.push("");
  lines.push(`⏱️  Duration: ${response.meta.duration_ms}ms`);

  return lines.join("\n");
}

function groupToolsByPrefix(
  tools: Array<{ name: string; description?: string }>,
): Map<string, Array<{ name: string; description?: string }>> {
  const groups = new Map<string, Array<{ name: string; description?: string }>>();
  const ungrouped: Array<{ name: string; description?: string }> = [];

  for (const tool of tools) {
    const parts = tool.name.split(/[._-]/);
    if (parts.length > 1) {
      const prefix = parts[0];
      if (!groups.has(prefix)) {
        groups.set(prefix, []);
      }
      groups.get(prefix)!.push(tool);
    } else {
      ungrouped.push(tool);
    }
  }

  const sortedGroups = new Map([...groups.entries()].sort((a, b) => b[1].length - a[1].length));

  if (ungrouped.length > 0) {
    sortedGroups.set("", ungrouped);
  }

  return sortedGroups;
}

function formatDescribe(response: CliSuccessResponse): string {
  const result = response.result as {
    name: string;
    description?: string;
    input_schema?: {
      properties?: Record<string, { type: string; description?: string }>;
      required?: string[];
    };
    cli_args?: Array<{
      name: string;
      type: string;
      required: boolean;
      description?: string;
    }>;
  };

  const lines: string[] = [];
  lines.push(`🔍 Tool: ${result.name}`);
  lines.push("");

  if (result.description) {
    lines.push(result.description);
    lines.push("");
  }

  if (result.cli_args && result.cli_args.length > 0) {
    lines.push("Arguments:");

    const required = result.cli_args.filter((a) => a.required);
    const optional = result.cli_args.filter((a) => !a.required);

    if (required.length > 0) {
      lines.push("  Required:");
      for (const arg of required) {
        const desc = arg.description ? ` - ${arg.description}` : "";
        lines.push(`    --${arg.name.toLowerCase()} <${arg.type}>${desc}`);
      }
    }

    if (optional.length > 0) {
      lines.push("  Optional:");
      for (const arg of optional) {
        const desc = arg.description ? ` - ${arg.description}` : "";
        lines.push(`    --${arg.name.toLowerCase()} <${arg.type}>${desc}`);
      }
    }

    lines.push("");
  }

  lines.push("Usage:");
  lines.push(`  mcpwrap ${response.server} call --tool ${result.name} [...args]`);
  lines.push("");
  lines.push(`⏱️  Duration: ${response.meta.duration_ms}ms`);

  return lines.join("\n");
}

function formatCall(response: CliSuccessResponse): string {
  const lines: string[] = [];
  lines.push("✅ Success");
  lines.push("");
  lines.push(`Tool: ${response.tool}`);
  lines.push(`Server: ${response.server}`);
  lines.push("");
  lines.push("Result:");
  lines.push(JSON.stringify(response.result, null, 2));
  lines.push("");
  lines.push(`⏱️  Duration: ${response.meta.duration_ms}ms`);

  return lines.join("\n");
}

function formatInit(response: CliSuccessResponse): string {
  const result = response.result as {
    output_dir: string;
    skill_name: string;
    tool_count: number;
    categories: string[];
    files_written: string[];
    dry_run?: boolean;
  };

  const lines: string[] = [];

  if (result.dry_run) {
    lines.push("🔍 Dry run - no files were written");
    lines.push("");
  } else {
    lines.push("✅ Skill template generated successfully!");
    lines.push("");
  }

  lines.push(`📁 Output: ${result.output_dir}`);
  lines.push(`🏷️  Skill Name: ${result.skill_name}`);
  lines.push(`🛠️  Tools: ${result.tool_count}`);
  lines.push(`📂 Categories: ${result.categories.join(", ")}`);
  lines.push("");

  if (result.files_written.length > 0) {
    lines.push(`Files written (${result.files_written.length}):`);
    for (const file of result.files_written) {
      lines.push(`  ✓ ${file}`);
    }
    lines.push("");
  }

  lines.push("Next steps:");
  lines.push(`  1. Review the generated files in ${result.output_dir}`);
  lines.push(`  2. Customize SKILL.md with your specific use cases`);
  lines.push(`  3. Use the skill with: mcpwrap ${result.skill_name} call --tool <name>`);
  lines.push("");
  lines.push(`⏱️  Duration: ${response.meta.duration_ms}ms`);

  return lines.join("\n");
}
