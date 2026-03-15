import type {
  ParsedArgs,
  McpJsonSchemaProperty,
  CliArgDefinition,
  McpTool,
} from "../types/index.ts";

export function parseCliArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    flags: {},
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--config") {
      if (i + 1 < args.length) parsed.config = args[++i];
    } else if (arg === "--tool") {
      if (i + 1 < args.length) parsed.tool = args[++i];
    } else if (arg === "--input") {
      if (i + 1 < args.length) parsed.input = args[++i];
    } else if (arg === "--input-file") {
      if (i + 1 < args.length) parsed.inputFile = args[++i];
    } else if (arg === "--output-dir") {
      if (i + 1 < args.length) parsed.outputDir = args[++i];
    } else if (arg === "--skill-name") {
      if (i + 1 < args.length) parsed.skillName = args[++i];
    } else if (arg === "--force") {
      parsed.force = true;
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--debug") {
      parsed.debug = true;
    } else if (arg === "--interactive") {
      parsed.interactive = true;
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[i + 1] ?? "";
      if (!value.startsWith("--") && i + 1 < args.length) {
        parsed.flags[key] = value;
        i++;
      } else {
        parsed.flags[key] = true;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      const value = args[i + 1] ?? "";
      if (!value.startsWith("-") && i + 1 < args.length) {
        parsed.flags[key] = value;
        i++;
      } else {
        parsed.flags[key] = true;
      }
    } else if (!parsed.server) {
      parsed.server = arg;
    } else if (!parsed.command) {
      parsed.command = arg;
    }
    i++;
  }

  return parsed;
}

export function normalizeFlagName(flagName: string): string {
  return flagName.replace(/^-+/g, "").replace(/[-_]+([a-zA-Z])/g, (_, char) => char.toUpperCase());
}

export function generateCliArgsFromSchema(tool: McpTool): CliArgDefinition[] {
  const schema = tool.inputSchema;
  if (!schema?.properties) {
    return [];
  }

  const args: CliArgDefinition[] = [];
  const required = new Set(schema.required ?? []);

  for (const [key, prop] of Object.entries(schema.properties)) {
    const argDef = schemaPropertyToCliArg(key, prop, required.has(key));
    args.push(argDef);
  }

  return args;
}

function schemaPropertyToCliArg(
  name: string,
  prop: McpJsonSchemaProperty,
  isRequired: boolean,
): CliArgDefinition {
  const type = mapSchemaTypeToCliType(prop.type);
  const aliases = generateAliases(name);

  return {
    name,
    aliases,
    type,
    required: isRequired,
    description: prop.description,
  };
}

function mapSchemaTypeToCliType(schemaType: string): CliArgDefinition["type"] {
  switch (schemaType) {
    case "string":
      return "string";
    case "integer":
      return "integer";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return "array";
    case "object":
      return "object";
    default:
      return "string";
  }
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

export function convertFlagsToInput(
  flags: Record<string, unknown>,
  schema: McpTool["inputSchema"],
): Record<string, unknown> {
  if (!schema?.properties) {
    return {};
  }

  const result: Record<string, unknown> = {};

  for (const [flagKey, flagValue] of Object.entries(flags)) {
    const normalizedKey = normalizeFlagName(flagKey);

    if (normalizedKey.endsWith("Json") || normalizedKey.endsWith("_json")) {
      const fieldName = normalizedKey.replace(/[Jj]son$/, "").replace(/_json$/, "");
      try {
        result[fieldName] = JSON.parse(flagValue as string);
      } catch (error) {
        console.warn(
          `[warn] Failed to parse JSON for ${fieldName}: ${
            error instanceof Error ? error.message : String(error)
          }. Using raw value.`,
        );
        result[fieldName] = flagValue;
      }
      continue;
    }

    const matchingProperty = findMatchingProperty(normalizedKey, schema.properties);
    if (matchingProperty) {
      const [propName, propSchema] = matchingProperty;
      const convertedValue = convertValueType(flagValue, propSchema.type);

      if (propSchema.type === "array") {
        if (result[propName] === undefined) {
          result[propName] = [];
        }
        (result[propName] as unknown[]).push(convertedValue);
      } else {
        result[propName] = convertedValue;
      }
    }
  }

  return result;
}

function findMatchingProperty(
  normalizedKey: string,
  properties: Record<string, McpJsonSchemaProperty>,
): [string, McpJsonSchemaProperty] | undefined {
  for (const [propName, propSchema] of Object.entries(properties)) {
    if (propName.toLowerCase() === normalizedKey.toLowerCase()) {
      return [propName, propSchema];
    }
    const kebabName = propName
      .replace(/([A-Z])/g, "-$1")
      .toLowerCase()
      .replace(/^-/, "");
    if (kebabName === normalizedKey.toLowerCase()) {
      return [propName, propSchema];
    }
    const snakeName = propName
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .replace(/^_/, "");
    if (snakeName === normalizedKey.toLowerCase()) {
      return [propName, propSchema];
    }
    const flatName = propName.toLowerCase().replace(/[-_]/g, "");
    if (flatName === normalizedKey.toLowerCase()) {
      return [propName, propSchema];
    }
  }
  return undefined;
}

function convertValueType(value: unknown, targetType: string): unknown {
  if (targetType === "boolean") {
    if (typeof value === "string") {
      return value.toLowerCase() === "true" || value === "1";
    }
    return Boolean(value);
  }

  if (targetType === "integer") {
    if (typeof value === "string") {
      return parseInt(value, 10);
    }
    return Number(value);
  }

  if (targetType === "number") {
    if (typeof value === "string") {
      return parseFloat(value);
    }
    return Number(value);
  }

  return value;
}

export function validateRequiredArgs(
  input: Record<string, unknown>,
  schema: McpTool["inputSchema"],
): string[] {
  if (!schema?.required) {
    return [];
  }

  const missing: string[] = [];
  for (const requiredField of schema.required) {
    if (input[requiredField] === undefined || input[requiredField] === null) {
      missing.push(requiredField);
    }
  }

  return missing;
}
