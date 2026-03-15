# Media

Use this file for tools related to media operations.

## Included Tools

- create_attachment
- delete_attachment
- extract_images
- get_attachment
- get_issue

## create_attachment

Create a new attachment on a specific Linear issue by uploading base64-encoded content.

When to use: Create a new medi.

CLI:
```bash
node dist/cli.js linear call --tool create_attachment --issue <issue> --base64content <base64content> --filename <filename> --contenttype <contenttype>
```
Equivalent JSON input:
```json
{
  "issue": "<issue>",
  "base64Content": "<base64Content>",
  "filename": "<filename>",
  "contentType": "<contentType>"
}
```


Required fields:
  - issue
  - base64Content
  - filename
  - contentType

Output: See `references/manifest.md` for full schema details.

Safety:
- Use only when the user explicitly asked to modify data.
- Echo the changed fields in the response.


## delete_attachment

Delete an attachment by ID

When to use: Permanently remove a medi.

CLI:
```bash
node dist/cli.js linear call --tool delete_attachment --id <id>
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


## extract_images

Extract and fetch images from markdown content. Use this to view screenshots, diagrams, or other images embedded in Linear issues, comments, or documents. Pass the markdown content (e.g., issue description) and receive the images as viewable data.

When to use: Perform media-related operations.

CLI:
```bash
node dist/cli.js linear call --tool extract_images --markdown <markdown>
```
Equivalent JSON input:
```json
{
  "markdown": "<markdown>"
}
```


Required fields:
  - markdown

Output: See `references/manifest.md` for full schema details.


## get_attachment

Retrieve an attachment's content by ID.

When to use: Retrieve a single media by ID or identifier.

CLI:
```bash
node dist/cli.js linear call --tool get_attachment --id <id>
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


## get_issue

Retrieve detailed information about an issue by ID, including attachments and git branch name

When to use: Retrieve a single media by ID or identifier.

CLI:
```bash
node dist/cli.js linear call --tool get_issue --id <id>
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

