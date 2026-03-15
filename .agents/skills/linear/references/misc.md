# Misc Manifest

- Source server: linear
- Generated at: 2026-03-15T13:16:53.833Z
- Tools in category: 16

## Tools

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

## Tool Details

### create_document
- **Category**: misc
- **Risk**: write
- **Required**: title
- **Optional**: content, project, issue, icon, color
- **Complex fields**: None

### create_issue_label
- **Category**: misc
- **Risk**: write
- **Required**: name
- **Optional**: description, color, teamId, parent, isGroup
- **Complex fields**: None

### get_document
- **Category**: misc
- **Risk**: read
- **Required**: id
- **Optional**: 
- **Complex fields**: None

### get_issue_status
- **Category**: misc
- **Risk**: read
- **Required**: id, name, team
- **Optional**: 
- **Complex fields**: None

### get_milestone
- **Category**: misc
- **Risk**: read
- **Required**: project, query
- **Optional**: 
- **Complex fields**: None

### get_project
- **Category**: misc
- **Risk**: read
- **Required**: query
- **Optional**: includeMilestones, includeMembers, includeResources
- **Complex fields**: None

### get_team
- **Category**: misc
- **Risk**: read
- **Required**: query
- **Optional**: 
- **Complex fields**: None

### list_cycles
- **Category**: misc
- **Risk**: read
- **Required**: teamId
- **Optional**: type
- **Complex fields**: None

### list_issue_labels
- **Category**: misc
- **Risk**: read
- **Required**: None
- **Optional**: limit, cursor, orderBy, name, team
- **Complex fields**: None

### list_issue_statuses
- **Category**: misc
- **Risk**: read
- **Required**: team
- **Optional**: 
- **Complex fields**: None

### list_milestones
- **Category**: misc
- **Risk**: read
- **Required**: project
- **Optional**: 
- **Complex fields**: None

### list_project_labels
- **Category**: misc
- **Risk**: read
- **Required**: None
- **Optional**: limit, cursor, orderBy, name
- **Complex fields**: None

### save_issue
- **Category**: misc
- **Risk**: write
- **Required**: None
- **Optional**: id, title, description, team, cycle...
- **Complex fields**: labels, links, blocks, blockedBy, relatedTo

### save_milestone
- **Category**: misc
- **Risk**: write
- **Required**: project
- **Optional**: id, name, description, targetDate
- **Complex fields**: None

### save_project
- **Category**: misc
- **Risk**: write
- **Required**: None
- **Optional**: id, name, icon, color, summary...
- **Complex fields**: addTeams, removeTeams, setTeams, labels, addInitiatives, removeInitiatives, setInitiatives

### update_document
- **Category**: misc
- **Risk**: write
- **Required**: id
- **Optional**: title, content, project, icon, color
- **Complex fields**: None
