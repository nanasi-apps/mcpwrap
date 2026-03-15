# node dist/cli.js

MCP (Model Context Protocol) to CLI bridge tool. Use OpenCode's MCP configuration directly from the command line.

## Features

- 🔌 **Local & Remote MCP Servers** - Support for both stdio-based local servers and HTTP remote servers
- 🔐 **OAuth Authentication** - Reuses existing OpenCode authentication tokens
- 🛠️ **Schema-based CLI Arguments** - Automatically converts tool schemas to CLI flags
- 📦 **AgentSkills Generation** - Generate skill templates for AI agents
- 📊 **Structured Output** - JSON responses with consistent error handling

## Installation

```bash
# Using pnpm (recommended)
pnpm add -g node dist/cli.js

# Or use directly with npx
npx node dist/cli.js list-servers
```

## Quick Start

```bash
# List configured MCP servers
node dist/cli.js list-servers

# List tools from a server
node dist/cli.js <server> list-tools

# Describe a tool (see required arguments)
node dist/cli.js <server> describe --tool <tool-name>

# Call a tool
node dist/cli.js <server> call --tool <tool-name> --arg value

# Generate AgentSkills template
node dist/cli.js <server> init --output-dir ./skills --skill-name my-skill
```

## Configuration

node dist/cli.js reads MCP server configurations from OpenCode's config file:

**Default locations (in order of priority):**

1. Custom path: `--config /path/to/config.json`
2. `~/.config/opencode/opencode.json`
3. `~/.config/opencode/opencode.jsonc`

**Example OpenCode config:**

```json
{
  "mcp": {
    "my-server": {
      "type": "local",
      "command": ["npx", "-y", "@myorg/mcp-server"],
      "enabled": true
    },
    "remote-api": {
      "type": "remote",
      "url": "https://api.example.com/mcp",
      "oauth": true,
      "timeout": 30000
    }
  }
}
```

## Commands

### Global Commands

| Command        | Description                     |
| -------------- | ------------------------------- |
| `list-servers` | List all configured MCP servers |

### Server Commands

| Command                                                | Description                         |
| ------------------------------------------------------ | ----------------------------------- |
| `<server> list-tools`                                  | List available tools from a server  |
| `<server> describe --tool <name>`                      | Show tool details and CLI arguments |
| `<server> call --tool <name> [args...]`                | Execute a tool with arguments       |
| `<server> init --output-dir <dir> --skill-name <name>` | Generate AgentSkills template       |

### Call Options

| Option                | Description                                          |
| --------------------- | ---------------------------------------------------- |
| `--tool <name>`       | Tool name to call                                    |
| `--input <json>`      | JSON input string                                    |
| `--input-file <path>` | JSON input from file                                 |
| `--<arg> <value>`     | Tool-specific arguments (auto-generated from schema) |

### Global Options

| Option            | Description                       |
| ----------------- | --------------------------------- |
| `--config <path>` | Path to OpenCode config file      |
| `--debug`         | Enable debug mode (stderr output) |
| `--help, -h`      | Show help                         |

## Input Methods

### 1. JSON String

```bash
node dist/cli.js notion call --tool pages.get --input '{"pageId":"123"}'
```

### 2. JSON File

```bash
node dist/cli.js notion call --tool pages.get --input-file payload.json
```

### 3. CLI Arguments (Auto-generated from schema)

```bash
# These are equivalent:
node dist/cli.js notion call --tool pages.get --pageId 123
node dist/cli.js notion call --tool pages.get --page-id 123
node dist/cli.js notion call --tool pages.get --page_id 123
node dist/cli.js notion call --tool pages.get --pageid 123
```

### Array Arguments

```bash
node dist/cli.js notion call --tool tags.add --tag a --tag b --tag c
```

### JSON Object Arguments

```bash
node dist/cli.js notion call --tool pages.create --properties-json '{"icon":"🔥"}'
```

## Output Format

All responses are structured JSON:

### Success Response

```json
{
  "ok": true,
  "server": "notion",
  "action": "call",
  "tool": "pages.get",
  "result": { ... },
  "meta": {
    "duration_ms": 128,
    "transport": "streamable_http",
    "exit_code": 0
  }
}
```

### Error Response

```json
{
  "ok": false,
  "server": "notion",
  "action": "call",
  "tool": "pages.get",
  "error": {
    "code": "REQUIRED_ARGUMENT_MISSING",
    "category": "tool",
    "message": "Missing required argument 'pageId'",
    "retryable": false,
    "hint": "Use: --pageid <value>",
    "next_action": {
      "type": "command",
      "command": "node dist/cli.js notion describe --tool pages.get"
    }
  },
  "meta": {
    "duration_ms": 12,
    "exit_code": 1
  }
}
```

## Error Categories

| Category    | Description                |
| ----------- | -------------------------- |
| `config`    | Configuration file issues  |
| `auth`      | Authentication errors      |
| `transport` | Network/connection errors  |
| `protocol`  | MCP protocol errors        |
| `tool`      | Tool execution errors      |
| `init`      | Template generation errors |
| `internal`  | Internal errors            |

## Authentication

node dist/cli.js reuses OpenCode's authentication:

1. Check if auth token exists in `~/.local/share/opencode/mcp-auth.json`
2. If valid (not expired), use it automatically
3. If missing/expired, returns `AUTH_REQUIRED` error with hint

```bash
# Authenticate via OpenCode first
opencode mcp auth <server>

# Then use node dist/cli.js
node dist/cli.js <server> list-tools
```

## Development

```bash
# Install dependencies
vp install

# Build
vp build

# Run type check and lint
vp check

# Format code
vp fmt
```

## Project Structure

```
src/
├── cli.ts              # CLI entry point
├── index.ts            # Library exports
├── types/
│   └── index.ts        # Type definitions
├── config/
│   └── loader.ts       # Config loading utilities
├── transport/
│   ├── http.ts         # HTTP transport (remote servers)
│   └── stdio.ts        # Stdio transport (local servers)
└── utils/
    ├── args.ts         # CLI argument parsing
    └── init.ts         # Skill template generation
```

## License

MIT
