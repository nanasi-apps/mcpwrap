# Media Manifest

- Source server: linear
- Generated at: 2026-03-15T13:16:53.833Z
- Tools in category: 5

## Tools

- create_attachment
- delete_attachment
- extract_images
- get_attachment
- get_issue

## Tool Details

### create_attachment
- **Category**: media
- **Risk**: write
- **Required**: issue, base64Content, filename, contentType
- **Optional**: title, subtitle
- **Complex fields**: None

### delete_attachment
- **Category**: media
- **Risk**: write
- **Required**: id
- **Optional**: 
- **Complex fields**: None

### extract_images
- **Category**: media
- **Risk**: unknown
- **Required**: markdown
- **Optional**: 
- **Complex fields**: None

### get_attachment
- **Category**: media
- **Risk**: read
- **Required**: id
- **Optional**: 
- **Complex fields**: None

### get_issue
- **Category**: media
- **Risk**: read
- **Required**: id
- **Optional**: includeRelations, includeCustomerNeeds
- **Complex fields**: None
