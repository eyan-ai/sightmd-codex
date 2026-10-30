---
name: sightmd-codex
description: Open and edit Markdown files in the SightMD panel inside Codex. Use when the user asks to preview, edit, review, or save a Markdown document with a live rendered view.
---

# SightMD for Codex

Use the `sightmd` MCP server for Markdown editing.

## Open

Call `open_markdown_editor` with the absolute path when the user asks to open, preview, review, or edit a Markdown file. Prefer the requested mode when one is named: `preview`, `split`, or `readonly`.

Present the returned editor URL as the interactive result when the Codex host supports embedded widgets. If the host only shows links, provide the local editor URL and keep the file path visible.

## Save

The editor saves through the `write_markdown` tool. Confirm the saved path and report any conflict state before claiming the save completed.

## Scope

Only pass `.md` and `.markdown` files. Do not silently overwrite a dirty document after an external file change; ask the user which version to keep.
