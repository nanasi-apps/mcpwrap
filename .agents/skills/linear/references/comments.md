# Comments Manifest

- Source server: linear
- Generated at: 2026-03-15T13:16:53.833Z
- Tools in category: 3

## Tools

- delete_comment
- list_comments
- save_comment

## Tool Details

### delete_comment
- **Category**: comments
- **Risk**: write
- **Required**: id
- **Optional**: 
- **Complex fields**: None

### list_comments
- **Category**: comments
- **Risk**: read
- **Required**: issueId
- **Optional**: limit, cursor, orderBy
- **Complex fields**: None

### save_comment
- **Category**: comments
- **Risk**: write
- **Required**: body
- **Optional**: id, issueId, parentId
- **Complex fields**: None
