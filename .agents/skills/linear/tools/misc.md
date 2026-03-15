# Misc

Use this file for tools related to misc operations.

## Included Tools

- create_document
- create_issue_label
- get_document
- get_issue_status
- get_milestone
- get_project
- get_team
- list_cycles
- list_issue_labels
- list_issue_statuses
- list_milestones
- list_project_labels
- save_issue
- save_milestone
- save_project
- update_document

## create_document

Create a new document in Linear

When to use: Create a new mis.

CLI:
```bash
node dist/cli.js linear call --tool create_document --title <title>
```
Equivalent JSON input:
```json
{
  "title": "<title>"
}
```


Required fields:
  - title

Output: See `references/manifest.md` for full schema details.

Safety:
- Use only when the user explicitly asked to modify data.
- Echo the changed fields in the response.


## create_issue_label

Create a new Linear issue label

When to use: Create a new mis.

CLI:
```bash
node dist/cli.js linear call --tool create_issue_label --name <name>
```
Equivalent JSON input:
```json
{
  "name": "<name>"
}
```


Required fields:
  - name

Output: See `references/manifest.md` for full schema details.

Safety:
- Use only when the user explicitly asked to modify data.
- Echo the changed fields in the response.


## get_document

Retrieve a Linear document by ID or slug

When to use: Retrieve a single misc by ID or identifier.

CLI:
```bash
node dist/cli.js linear call --tool get_document --id <id>
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


## get_issue_status

Retrieve detailed information about an issue status in Linear by name or ID

When to use: Retrieve a single misc by ID or identifier.

CLI:
```bash
node dist/cli.js linear call --tool get_issue_status --id <id> --name <name> --team <team>
```
Equivalent JSON input:
```json
{
  "id": "<id>",
  "name": "<name>",
  "team": "<team>"
}
```


Required fields:
  - id
  - name
  - team

Output: See `references/manifest.md` for full schema details.


## get_milestone

Retrieve details of a specific milestone by ID or name

When to use: Retrieve a single misc by ID or identifier.

CLI:
```bash
node dist/cli.js linear call --tool get_milestone --project <project> --query <query>
```
Equivalent JSON input:
```json
{
  "project": "<project>",
  "query": "<query>"
}
```


Required fields:
  - project
  - query

Output: See `references/manifest.md` for full schema details.


## get_project

Retrieve details of a specific project in Linear

When to use: Retrieve a single misc by ID or identifier.

CLI:
```bash
node dist/cli.js linear call --tool get_project --query <query>
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


## get_team

Retrieve details of a specific Linear team

When to use: Retrieve a single misc by ID or identifier.

CLI:
```bash
node dist/cli.js linear call --tool get_team --query <query>
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


## list_cycles

Retrieve cycles for a specific Linear team

When to use: Find multiple misc matching criteria.

CLI:
```bash
node dist/cli.js linear call --tool list_cycles --teamid <teamid>
```
Equivalent JSON input:
```json
{
  "teamId": "<teamId>"
}
```


Required fields:
  - teamId

Output: See `references/manifest.md` for full schema details.


## list_issue_labels

List available issue labels in a Linear workspace or team

When to use: Find multiple misc matching criteria.

CLI:
```bash
node dist/cli.js linear call --tool list_issue_labels
```

Required fields:
  - None

Output: See `references/manifest.md` for full schema details.


## list_issue_statuses

List available issue statuses in a Linear team

When to use: Find multiple misc matching criteria.

CLI:
```bash
node dist/cli.js linear call --tool list_issue_statuses --team <team>
```
Equivalent JSON input:
```json
{
  "team": "<team>"
}
```


Required fields:
  - team

Output: See `references/manifest.md` for full schema details.


## list_milestones

List all milestones in a Linear project

When to use: Find multiple misc matching criteria.

CLI:
```bash
node dist/cli.js linear call --tool list_milestones --project <project>
```
Equivalent JSON input:
```json
{
  "project": "<project>"
}
```


Required fields:
  - project

Output: See `references/manifest.md` for full schema details.


## list_project_labels

List available project labels in the Linear workspace

When to use: Find multiple misc matching criteria.

CLI:
```bash
node dist/cli.js linear call --tool list_project_labels
```

Required fields:
  - None

Output: See `references/manifest.md` for full schema details.


## save_issue

Create or update a Linear issue. If `id` is provided, updates the existing issue; otherwise creates a new one. When creating, `title` and `team` are required.

When to use: Perform misc-related operations.

CLI:
```bash
node dist/cli.js linear call --tool save_issue
```

Required fields:
  - None

Output: See `references/manifest.md` for full schema details.

Safety:
- Use only when the user explicitly asked to modify data.
- Echo the changed fields in the response.


## save_milestone

Create or update a milestone in a Linear project. If `id` is provided, updates the existing milestone; otherwise creates a new one. When creating, `name` is required.

When to use: Perform misc-related operations.

CLI:
```bash
node dist/cli.js linear call --tool save_milestone --project <project>
```
Equivalent JSON input:
```json
{
  "project": "<project>"
}
```


Required fields:
  - project

Output: See `references/manifest.md` for full schema details.

Safety:
- Use only when the user explicitly asked to modify data.
- Echo the changed fields in the response.


## save_project

Create or update a Linear project. If `id` is provided, updates the existing project; otherwise creates a new one. When creating, `name` and at least one team (via `addTeams` or `setTeams`) are required.

When to use: Perform misc-related operations.

CLI:
```bash
node dist/cli.js linear call --tool save_project
```

Required fields:
  - None

Output: See `references/manifest.md` for full schema details.

Safety:
- Use only when the user explicitly asked to modify data.
- Echo the changed fields in the response.


## update_document

Update an existing Linear document

When to use: Modify an existing mis.

CLI:
```bash
node dist/cli.js linear call --tool update_document --id <id>
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

