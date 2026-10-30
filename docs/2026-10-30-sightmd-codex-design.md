# SightMD Codex Panel Design

## Goal

Provide a Codex plugin that opens a Markdown file in a SightMD editor surface that can be shown in Codex, without requiring the VS Code Extension Host.

## Architecture

- `.codex-plugin/plugin.json` registers the plugin metadata and interaction capability.
- `.mcp.json` starts the local MCP server.
- `server.mjs` exposes `open_markdown_editor`, `read_markdown`, and `write_markdown` tools and serves the local editor over loopback HTTP.
- `app/` contains the migrated SightMD renderer, editor logic, and a small host bridge that translates editor events into file reads and writes.
- `skills/sightmd-codex/SKILL.md` tells Codex when to call the editor tool and how to report save and conflict states.

## Data flow

1. Codex calls `open_markdown_editor` with an absolute `.md` or `.markdown` path.
2. The server reads the file and starts a loopback HTTP endpoint if needed.
3. The tool returns the editor URL and a widget template hint for Codex-capable hosts.
4. The editor loads the document into SightMD and reports edits through the host bridge.
5. Save writes the complete Markdown text back to the original path with a temporary file and rename.
6. The editor polls the file mtime. External changes reload only when the editor is clean; dirty external changes show a conflict state.

## Acceptance

- Plugin metadata and MCP configuration parse as JSON.
- Server starts without third-party dependencies.
- Read and write tools work over newline-delimited JSON-RPC.
- HTTP read/write/stat endpoints work for Markdown files.
- The browser editor loads the migrated SightMD resources and sends edit events through the bridge.
- Non-Markdown paths are rejected.
