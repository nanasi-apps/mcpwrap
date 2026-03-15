# Comments

Use this file for tools related to comments operations.

## Included Tools

- delete_comment
- list_comments
- save_comment

## delete_comment

Delete a comment from a Linear issue

When to use: Permanently remove a comment.

CLI:
```bash
node dist/cli.js linear call --tool delete_comment --id <id>
```
Equivalent JSON input:
```json
{
  "id": "<id>"
}
```


Required fields:
  - id

Output: See `references/manifest.md` for full schema details.

Safety:
- Use only when the user explicitly asked to modify data.
- Echo the changed fields in the response.


## list_comments

List comments for a specific Linear issue

When to use: Find multiple comments matching criteria.

CLI:
```bash
node dist/cli.js linear call --tool list_comments --issueid <issueid>
```
Equivalent JSON input:
```json
{
  "issueId": "<issueId>"
}
```


Required fields:
  - issueId

Output: See `references/manifest.md` for full schema details.


## save_comment

Create or update a comment on a Linear issue. If `id` is provided, updates the existing comment; otherwise creates a new one. When creating, `issueId` and `body` are required.

When to use: Perform comments-related operations.

CLI:
```bash
node dist/cli.js linear call --tool save_comment --body <body>
```
Equivalent JSON input:
```json
{
  "body": "<body>"
}
```


Required fields:
  - body

Output: See `references/manifest.md` for full schema details.

Safety:
- Use only when the user explicitly asked to modify data.
- Echo the changed fields in the response.

