# Memory System Configuration

## File-Based Memory System

This project uses a file-based memory system instead of internal memory storage. All memories and project context must be stored in files within the `.windsurf` directory structure.

### Directory Structure
```
.windsurf/
├── plans/              # Future implementation plans
├── task-logs/         # Task-specific progress logs
├── activeContext.md   # Current project state
├── productContext.md  # Product requirements and goals
├── progress.md        # Overall progress tracking
├── projectbrief.md    # Project overview
├── systemPatterns.md  # Architecture and patterns
└── techContext.md     # Technical specifications
```

### Memory Types and Storage Rules

1. **Implementation Plans**
   - Location: `.windsurf/plans/`
   - Format: `YYYY-MM-DD-plan-name.md`
   - Example: `2025-03-27-ammo-js-migration.md`

2. **Task Logs**
   - Location: `.windsurf/task-logs/`
   - Format: `YYYY-MM-DD-task-name.md`
   - Include start time, completion time, and outcomes

3. **Project Context**
   - Location: `.windsurf/` root
   - Core files must always be maintained
   - Update with timestamps for each modification

### Rules for Memory Operations

1. **Creating Memories**
   - Always create as Markdown files
   - Include creation timestamp
   - Use appropriate directory based on content type

2. **Updating Memories**
   - Add new content at the top of files
   - Never delete existing content
   - Include update timestamps
   - Use horizontal rules to separate entries

3. **Accessing Memories**
   - Read from files directly
   - Use relative links for cross-references
   - Maintain directory indexes

4. **Important Note**
   DO NOT use the internal memory system. All memories must be stored in files.
