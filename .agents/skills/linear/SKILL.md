---
name: linear
description: Manage Linear content through CLI wrappers around an OpenCode-configured MCP server. Use when you need to inspect, search, list, create, or update Linear resources without loading the full MCP toolset into context.
---

# Overview

Use this skill as a lightweight router for MCP-backed Linear operations.

## Categories

- **Users**: Read `tools/users.md`
- **Search**: Read `tools/search.md`
- **Misc**: Read `tools/misc.md`
- **Comments**: Read `tools/comments.md`
- **Media**: Read `tools/media.md`

## Shared Rules

- Prefer direct CLI arguments for simple primitive fields.
- Use `--input` for nested objects or complex payloads.
- Read the relevant category file before invoking a tool.
- Do not perform write operations without explicit user intent.
- If a call fails, inspect the structured error and follow the suggested next action.

## Write Operation Safety

Tools marked as "write" risk require explicit user confirmation before execution.
Always echo the changed fields in your response when performing modifications.
