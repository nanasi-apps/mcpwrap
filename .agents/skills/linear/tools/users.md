# Users

Use this file for tools related to users operations.

## Included Tools

- get_user
- list_documents
- list_issues
- list_projects
- list_teams
- list_users

## get_user

Retrieve details of a specific Linear user

When to use: Retrieve a single users by ID or identifier.

CLI:
```bash
node dist/cli.js linear call --tool get_user --query <query>
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


## list_documents

List documents in the user's Linear workspace

When to use: Find multiple users matching criteria.

CLI:
```bash
node dist/cli.js linear call --tool list_documents
```

Required fields:
  - None

Output: See `references/manifest.md` for full schema details.


## list_issues

List issues in the user's Linear workspace. For my issues, use "me" as the assignee. Use "null" for no assignee.

When to use: Find multiple users matching criteria.

CLI:
```bash
node dist/cli.js linear call --tool list_issues
```

Required fields:
  - None

Output: See `references/manifest.md` for full schema details.


## list_projects

List projects in the user's Linear workspace

When to use: Find multiple users matching criteria.

CLI:
```bash
node dist/cli.js linear call --tool list_projects
```

Required fields:
  - None

Output: See `references/manifest.md` for full schema details.


## list_teams

List teams in the user's Linear workspace

When to use: Find multiple users matching criteria.

CLI:
```bash
node dist/cli.js linear call --tool list_teams
```

Required fields:
  - None

Output: See `references/manifest.md` for full schema details.


## list_users

Retrieve users in the Linear workspace

When to use: Find multiple users matching criteria.

CLI:
```bash
node dist/cli.js linear call --tool list_users
```

Required fields:
  - None

Output: See `references/manifest.md` for full schema details.

