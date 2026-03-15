# Search

Use this file for tools related to search operations.

## Included Tools

- search_documentation

## search_documentation

Search Linear's documentation to learn about features and usage

When to use: Find multiple search matching criteria.

CLI:
```bash
node dist/cli.js linear call --tool search_documentation --query <query>
```
Equivalent JSON input:
```json
{
  "query": "<query>"
}
```


Required fields:
  - query

Output: See `references/manifest.md` for full schema details.

