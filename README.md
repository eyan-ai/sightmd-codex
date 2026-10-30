# SightMD for Codex

A Codex plugin adaptation of SightMD 0.1.6-fix2.

## What is included

- Codex plugin metadata in `.codex-plugin/plugin.json`
- Local MCP server in `server.mjs`
- SightMD editor app in `app/`
- Markdown open/read/write tools
- Preview, Split Edit, and Read Only modes
- Dirty-state and external-change conflict handling

## Run locally

```sh
npm test
npm run start
```

Then open:

```text
http://127.0.0.1:<printed-port>/editor?path=/absolute/path/to/file.md&mode=split
```

## Codex loading

Install or link this project as a local Codex plugin. The plugin starts `server.mjs` through `.mcp.json`. Ask Codex to open an absolute Markdown path in SightMD.

This project keeps the VS Code extension unchanged. The Codex adapter uses a loopback HTTP bridge because the VS Code Extension Host is not available inside Codex.
