import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { McpTool, DiscoveredTool, ToolRisk, InitOptions } from "../types/index.ts";

export class InitError extends Error {
  code: string;
  phase?: string;
  tool?: string;
  file?: string;

  constructor(
    code: string,
    message: string,
    details?: { phase?: string; tool?: string; file?: string },
  ) {
    super(message);
    this.name = "InitError";
    this.code = code;
    this.phase = details?.phase;
    this.tool = details?.tool;
    this.file = details?.file;
  }
}

export interface InitResult {
  outputDir: string;
  skillName: string;
  serverName: string;
  toolCount: number;
  categories: string[];
  filesWritten: string[];
  dryRun: boolean;
}

interface ToolCategory {
  name: string;
  tools: DiscoveredTool[];
}

const WRITE_KEYWORDS = [
  "create",
  "update",
  "edit",
  "patch",
  "delete",
  "remove",
  "archive",
  "move",
  "publish",
  "post",
  "add",
  "insert",
  "set",
  "modify",
  "change",
];

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /^(?:get|list|search|find|query|describe|fetch)\.?post/i, category: "posts" },
  { pattern: /post/i, category: "posts" },
  { pattern: /^(?:get|list|search|find|query|describe|fetch)\.?page/i, category: "pages" },
  { pattern: /page/i, category: "pages" },
  { pattern: /database|db/i, category: "databases" },
  { pattern: /user/i, category: "users" },
  { pattern: /comment/i, category: "comments" },
  { pattern: /tag/i, category: "tags" },
  { pattern: /media|file|upload|image|attachment/i, category: "media" },
  { pattern: /search/i, category: "search" },
];

function detectRisk(tool: McpTool): ToolRisk {
  const text = `${tool.name} ${tool.description ?? ""}`.toLowerCase();

  const hasWriteKeyword = WRITE_KEYWORDS.some((kw) => text.includes(kw));
  const hasReadKeyword = /get|list|search|find|query|describe|fetch|read|view|show/i.test(
    tool.name,
  );

  if (hasWriteKeyword && !hasReadKeyword) {
    return "write";
  }
  if (hasReadKeyword && !hasWriteKeyword) {
    return "read";
  }
  return "unknown";
}

function detectCategory(tool: McpTool): string {
  const name = tool.name;

  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(name)) {
      return category;
    }
  }

  if (tool.description) {
    for (const { pattern, category } of CATEGORY_PATTERNS) {
      if (pattern.test(tool.description)) {
        return category;
      }
    }
  }

  return "misc";
}

function generateCliExample(tool: DiscoveredTool, serverName: string): string {
  const requiredArgs = tool.requiredFields ?? [];

  if (requiredArgs.length === 0) {
    return `mcpwrap ${serverName} call --tool ${tool.name}`;
  }

  const simpleArgs: string[] = [];
  let needsJsonInput = false;

  for (const field of requiredArgs) {
    const arg = tool.cliArgs.find((a) => a.name === field);
    if (!arg) continue;

    if (arg.type === "object" || arg.type === "array") {
      needsJsonInput = true;
      break;
    }

    const exampleValue = getExampleValue(arg);
    simpleArgs.push(`--${field.toLowerCase()} ${exampleValue}`);
  }

  if (needsJsonInput && tool.examples.json) {
    const jsonStr = JSON.stringify(tool.examples.json).replace(/"/g, '"');
    return `mcpwrap ${serverName} call --tool ${tool.name} --input '${jsonStr}'`;
  }

  return `mcpwrap ${serverName} call --tool ${tool.name} ${simpleArgs.join(" ")}`;
}

function getExampleValue(arg: DiscoveredTool["cliArgs"][number]): string {
  switch (arg.type) {
    case "string":
      return `<${arg.name.toLowerCase()}>`;
    case "integer":
    case "number":
      return "123";
    case "boolean":
      return "true";
    default:
      return `<${arg.name.toLowerCase()}>`;
  }
}

function generateJsonExample(tool: DiscoveredTool): Record<string, unknown> | null {
  const requiredFields = tool.requiredFields ?? [];
  if (requiredFields.length === 0) {
    return null;
  }

  const example: Record<string, unknown> = {};

  for (const field of requiredFields) {
    const arg = tool.cliArgs.find((a) => a.name === field);
    if (!arg) continue;

    switch (arg.type) {
      case "string":
        example[field] = `<${field}>`;
        break;
      case "integer":
      case "number":
        example[field] = 123;
        break;
      case "boolean":
        example[field] = true;
        break;
      case "array":
        example[field] = ["item1", "item2"];
        break;
      case "object":
        example[field] = { key: "value" };
        break;
    }
  }

  return example;
}

function generateAliases(name: string): string[] {
  const aliases: string[] = [];
  aliases.push(`--${name.toLowerCase()}`);

  const kebabCase = name.replace(/([A-Z])/g, "-$1").toLowerCase();
  if (kebabCase !== name.toLowerCase()) {
    aliases.push(`--${kebabCase}`);
  }

  const snakeCase = name.replace(/([A-Z])/g, "_$1").toLowerCase();
  if (snakeCase !== name.toLowerCase()) {
    aliases.push(`--${snakeCase}`);
  }

  const flatCase = name.toLowerCase().replace(/[-_]/g, "");
  aliases.push(`--${flatCase}`);

  return [...new Set(aliases)];
}

function normalizeTool(tool: McpTool): DiscoveredTool {
  const schema = tool.inputSchema;
  const requiredFields = schema?.required ?? [];
  const properties = schema?.properties ?? {};

  const cliArgs: DiscoveredTool["cliArgs"] = [];
  for (const [key, prop] of Object.entries(properties)) {
    const type =
      prop.type === "integer"
        ? "integer"
        : prop.type === "number"
          ? "number"
          : prop.type === "boolean"
            ? "boolean"
            : prop.type === "array"
              ? "array"
              : prop.type === "object"
                ? "object"
                : "string";

    cliArgs.push({
      name: key,
      aliases: generateAliases(key),
      type,
      required: requiredFields.includes(key),
      description: prop.description,
    });
  }

  const normalized: DiscoveredTool = {
    name: tool.name,
    description: tool.description ?? "No description available",
    category: detectCategory(tool),
    risk: detectRisk(tool),
    inputSchema: schema,
    requiredFields,
    cliArgs,
    examples: {
      cli: [],
      json: null,
    },
  };

  normalized.examples.json = generateJsonExample(normalized);

  return normalized;
}

function groupByCategory(tools: DiscoveredTool[]): ToolCategory[] {
  const groups = new Map<string, DiscoveredTool[]>();

  for (const tool of tools) {
    if (!groups.has(tool.category)) {
      groups.set(tool.category, []);
    }
    groups.get(tool.category)!.push(tool);
  }

  const categories = Array.from(groups.entries()).map(([name, tools]) => ({
    name,
    tools: tools.sort((a, b) => a.name.localeCompare(b.name)),
  }));

  const priority = ["posts", "pages", "databases", "users", "search", "misc"];
  categories.sort((a, b) => {
    const aIdx = priority.indexOf(a.name);
    const bIdx = priority.indexOf(b.name);
    if (aIdx === -1 && bIdx === -1) return a.name.localeCompare(b.name);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  return categories;
}

function generateSkillMd(
  skillName: string,
  _serverName: string,
  categories: ToolCategory[],
): string {
  const displayName = skillName.charAt(0).toUpperCase() + skillName.slice(1);

  const categoryList = categories
    .map(
      (cat) =>
        `- **${cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}**: Read \`tools/${cat.name}.md\``,
    )
    .join("\n");

  return `---
name: ${skillName}
description: Manage ${displayName} content through CLI wrappers around an OpenCode-configured MCP server. Use when you need to inspect, search, list, create, or update ${displayName} resources without loading the full MCP toolset into context.
---

# Overview

Use this skill as a lightweight router for MCP-backed ${displayName} operations.

## Categories

${categoryList}

## Shared Rules

- Prefer direct CLI arguments for simple primitive fields.
- Use \`--input\` for nested objects or complex payloads.
- Read the relevant category file before invoking a tool.
- Do not perform write operations without explicit user intent.
- If a call fails, inspect the structured error and follow the suggested next action.

## Write Operation Safety

Tools marked as "write" risk require explicit user confirmation before execution.
Always echo the changed fields in your response when performing modifications.
`;
}

function generateToolMd(category: ToolCategory, serverName: string): string {
  console.log(`Generating tool docs for category ${category.name} with server ${serverName}`);
  const toolList = category.tools.map((t) => `- ${t.name}`).join("\n");

  const toolDocs = category.tools
    .map((tool) => {
      const requiredList = tool.requiredFields.length
        ? tool.requiredFields.map((f) => `  - ${f}`).join("\n")
        : "  - None";

      const cliExample = generateCliExample(tool, serverName);
      const jsonExample = tool.examples.json ? JSON.stringify(tool.examples.json, null, 2) : null;

      const jsonSection = jsonExample
        ? `
Equivalent JSON input:
\`\`\`json
${jsonExample}
\`\`\`
`
        : "";

      const safetySection =
        tool.risk === "write"
          ? `
Safety:
- Use only when the user explicitly asked to modify data.
- Echo the changed fields in the response.
`
          : "";

      return `## ${tool.name}

${tool.description}

When to use: ${getUsageDescription(tool)}

CLI:
\`\`\`bash
${cliExample}
\`\`\`${jsonSection}

Required fields:
${requiredList}

Output: See \`references/manifest.md\` for full schema details.
${safetySection}`;
    })
    .join("\n\n");

  return `# ${category.name.charAt(0).toUpperCase() + category.name.slice(1)}

Use this file for tools related to ${category.name} operations.

## Included Tools

${toolList}

${toolDocs}
`;
}

function getUsageDescription(tool: DiscoveredTool): string {
  const nameLower = tool.name.toLowerCase();

  if (/get|fetch/.test(nameLower)) {
    return `Retrieve a single ${tool.category} by ID or identifier.`;
  }
  if (/list|search|query/.test(nameLower)) {
    return `Find multiple ${tool.category} matching criteria.`;
  }
  if (/create|add|insert/.test(nameLower)) {
    return `Create a new ${tool.category.slice(0, -1)}.`;
  }
  if (/update|edit|modify/.test(nameLower)) {
    return `Modify an existing ${tool.category.slice(0, -1)}.`;
  }
  if (/delete|remove/.test(nameLower)) {
    return `Permanently remove a ${tool.category.slice(0, -1)}.`;
  }

  return `Perform ${tool.category}-related operations.`;
}

function generateToolSummary(tool: DiscoveredTool): string {
  const optionalFields = Object.keys(tool.inputSchema?.properties ?? {}).filter(
    (f) => !tool.requiredFields.includes(f),
  );

  return `### ${tool.name}
- **Category**: ${tool.category}
- **Risk**: ${tool.risk}
- **Required**: ${tool.requiredFields.join(", ") || "None"}
- **Optional**: ${optionalFields.slice(0, 5).join(", ")}${optionalFields.length > 5 ? "..." : ""}
- **Complex fields**: ${
    tool.cliArgs
      .filter((a) => a.type === "object" || a.type === "array")
      .map((a) => a.name)
      .join(", ") || "None"
  }`;
}

function generateCategoryManifestMd(
  category: ToolCategory,
  serverName: string,
  timestamp: string,
): string {
  const toolList = category.tools.map((t) => `- ${t.name}`).join("\n");
  const toolSummaries = category.tools.map(generateToolSummary).join("\n\n");

  return `# ${category.name.charAt(0).toUpperCase() + category.name.slice(1)} Manifest

- Source server: ${serverName}
- Generated at: ${timestamp}
- Tools in category: ${category.tools.length}

## Tools

${toolList}

## Tool Details

${toolSummaries}
`;
}

function generateManifestIndexMd(
  skillName: string,
  serverName: string,
  categories: ToolCategory[],
  timestamp: string,
): string {
  const totalTools = categories.reduce((sum, cat) => sum + cat.tools.length, 0);

  const categoryLinks = categories
    .map(
      (cat) =>
        `- **${cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}**: See \`${cat.name}.md\` (${cat.tools.length} tools)`,
    )
    .join("\n");

  return `# Generated Manifest for ${skillName}

- Source server: ${serverName}
- Generated at: ${timestamp}
- Total discovered tools: ${totalTools}

## Category Manifests

${categoryLinks}

## Notes

- Write-like tools were marked as explicit intent only
- Category assignment used automatic name-based classification
- Complex nested objects require --input flag

## All Tools by Category

${categories
  .map(
    (cat) => `### ${cat.name}
${cat.tools.map((t) => `- ${t.name}`).join("\n")}`,
  )
  .join("\n\n")}
`;
}

function shouldSkipFile(filePath: string, force: boolean): boolean {
  if (force) return false;
  if (existsSync(filePath)) return true;
  return false;
}

export function generateSkillTemplate(options: InitOptions, tools: McpTool[]): InitResult {
  const { outputDir, skillName, serverName, force, dryRun } = options;
  const timestamp = new Date().toISOString();

  const discoveredTools = tools.map(normalizeTool);
  const categories = groupByCategory(discoveredTools);

  const filesWritten: string[] = [];
  const filesSkipped: string[] = [];

  const paths = {
    root: outputDir,
    tools: join(outputDir, "tools"),
    references: join(outputDir, "references"),
  };

  if (!dryRun) {
    try {
      mkdirSync(paths.root, { recursive: true });
      mkdirSync(paths.tools, { recursive: true });
      mkdirSync(paths.references, { recursive: true });
    } catch (error) {
      throw new InitError(
        "INIT_MKDIR_FAILED",
        `Failed to create output directories: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { phase: "render" },
      );
    }
  }

  const skillMdContent = generateSkillMd(skillName, serverName, categories);
  const skillMdPath = join(paths.root, "SKILL.md");
  if (!dryRun) {
    if (!shouldSkipFile(skillMdPath, force)) {
      try {
        writeFileSync(skillMdPath, skillMdContent);
        filesWritten.push("SKILL.md");
      } catch (error) {
        throw new InitError(
          "INIT_WRITE_FAILED",
          `Failed to write SKILL.md: ${error instanceof Error ? error.message : String(error)}`,
          { phase: "render", file: "SKILL.md" },
        );
      }
    } else {
      filesSkipped.push("SKILL.md");
    }
  }

  for (const category of categories) {
    const toolMdContent = generateToolMd(category, serverName);
    const toolMdPath = join(paths.tools, `${category.name}.md`);

    if (!dryRun) {
      if (!shouldSkipFile(toolMdPath, force)) {
        try {
          writeFileSync(toolMdPath, toolMdContent);
          filesWritten.push(`tools/${category.name}.md`);
        } catch (error) {
          throw new InitError(
            "INIT_WRITE_FAILED",
            `Failed to write tools/${category.name}.md: ${
              error instanceof Error ? error.message : String(error)
            }`,
            { phase: "render", file: `tools/${category.name}.md` },
          );
        }
      } else {
        filesSkipped.push(`tools/${category.name}.md`);
      }
    }
  }

  const manifestIndexContent = generateManifestIndexMd(
    skillName,
    serverName,
    categories,
    timestamp,
  );
  const manifestIndexPath = join(paths.references, "manifest.md");
  if (!dryRun) {
    if (!shouldSkipFile(manifestIndexPath, force)) {
      try {
        writeFileSync(manifestIndexPath, manifestIndexContent);
        filesWritten.push("references/manifest.md");
      } catch (error) {
        throw new InitError(
          "INIT_WRITE_FAILED",
          `Failed to write references/manifest.md: ${
            error instanceof Error ? error.message : String(error)
          }`,
          { phase: "render", file: "references/manifest.md" },
        );
      }
    } else {
      filesSkipped.push("references/manifest.md");
    }
  }

  for (const category of categories) {
    const categoryManifestContent = generateCategoryManifestMd(
      category,
      serverName,
      timestamp,
    );
    const categoryManifestPath = join(paths.references, `${category.name}.md`);

    if (!dryRun) {
      if (!shouldSkipFile(categoryManifestPath, force)) {
        try {
          writeFileSync(categoryManifestPath, categoryManifestContent);
          filesWritten.push(`references/${category.name}.md`);
        } catch (error) {
          throw new InitError(
            "INIT_WRITE_FAILED",
            `Failed to write references/${category.name}.md: ${
              error instanceof Error ? error.message : String(error)
            }`,
            { phase: "render", file: `references/${category.name}.md` },
          );
        }
      } else {
        filesSkipped.push(`references/${category.name}.md`);
      }
    }
  }

  if (filesSkipped.length > 0 && !force) {
    console.warn(
      `[warn] Skipped existing files (use --force to overwrite): ${filesSkipped.join(", ")}`,
    );
  }

  return {
    outputDir,
    skillName,
    serverName,
    toolCount: discoveredTools.length,
    categories: categories.map((c) => c.name),
    filesWritten,
    dryRun,
  };
}
