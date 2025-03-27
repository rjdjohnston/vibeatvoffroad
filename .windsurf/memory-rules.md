# Memory System Rules

## File-Based Memory Storage

All memories MUST be stored in files within the `.windsurf` directory structure following these rules:

1. **Directory Structure**
   - `/plans/` - For future implementation plans and architectural decisions
   - `/task-logs/` - For task-specific logs and progress
   - Root `.windsurf/` - For core project documentation files

2. **File Naming Convention**
   - Use kebab-case for all filenames
   - Include date for time-sensitive documents: `YYYY-MM-DD-description.md`
   - Use descriptive names that clearly indicate content

3. **Memory Categories and Locations**
   - Project Structure: `systemPatterns.md`
   - Technical Details: `techContext.md`
   - Product Information: `productContext.md`
   - Current Status: `activeContext.md`
   - Progress Tracking: `progress.md`
   - Project Overview: `projectbrief.md`

4. **File Format Requirements**
   - All files must be in Markdown format
   - Include a timestamp at the top of new entries
   - Use proper Markdown headings and formatting
   - Include relevant tags for searchability

5. **Memory Updates**
   - Never delete existing content
   - Add new content at the top of the file
   - Use horizontal rules (---) to separate entries
   - Include update timestamps

6. **Cross-Referencing**
   - Use relative links to reference other memory files
   - Maintain an index in each directory
   - Update related files when adding new information

IMPORTANT: DO NOT use the internal memory system. Always write to and read from these files for persistent storage.
