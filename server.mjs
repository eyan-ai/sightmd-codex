import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(ROOT, 'app');
const PORT = Number(process.env.SIGHTMD_PORT || 0);
let httpServer;
let httpPort;

function jsonRpc(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n'); }
function jsonRpcError(id, code, message) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n'); }
function assertMarkdown(filePath) {
  const resolved = path.resolve(String(filePath || ''));
  if (!/\.(md|markdown)$/i.test(resolved)) throw new Error('Only .md and .markdown files are supported');
  return resolved;
}
async function readMarkdown(filePath) {
  const resolved = assertMarkdown(filePath);
  const [content, stat] = await Promise.all([fs.readFile(resolved, 'utf8'), fs.stat(resolved)]);
  return { path: resolved, content, mtimeMs: stat.mtimeMs };
}
async function startHttp() {
  if (httpServer) return httpPort;
  httpServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
      if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
      if (url.pathname === '/api/read') {
        const data = await readMarkdown(url.searchParams.get('path'));
        return sendJson(res, 200, data);
      }
      if (url.pathname === '/api/stat') {
        const filePath = assertMarkdown(url.searchParams.get('path'));
        const stat = await fs.stat(filePath);
        return sendJson(res, 200, { path: filePath, mtimeMs: stat.mtimeMs });
      }
      if (url.pathname === '/api/write' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req));
        const filePath = assertMarkdown(body.path);
        const stat = await fs.stat(filePath);
        if (body.expectedMtimeMs != null && Math.abs(stat.mtimeMs - Number(body.expectedMtimeMs)) > 1) {
          return sendJson(res, 409, { code: 'CONFLICT', message: 'The file changed outside SightMD.' });
        }
        const tempPath = `${filePath}.sightmd-${process.pid}-${Date.now()}.tmp`;
        await fs.writeFile(tempPath, String(body.content ?? ''), 'utf8');
        await fs.rename(tempPath, filePath);
        const next = await fs.stat(filePath);
        return sendJson(res, 200, { path: filePath, mtimeMs: next.mtimeMs });
      }
      if (url.pathname === '/editor' || url.pathname === '/') return sendFile(res, path.join(APP_ROOT, 'index.html'), 'text/html; charset=utf-8');
      const relative = decodeURIComponent(url.pathname.replace(/^\//, ''));
      if (relative.includes('..')) return sendJson(res, 400, { message: 'Invalid asset path' });
      const filePath = path.join(APP_ROOT, relative);
      const type = relative.endsWith('.js') ? 'text/javascript; charset=utf-8' : relative.endsWith('.css') ? 'text/css; charset=utf-8' : relative.endsWith('.png') ? 'image/png' : relative.endsWith('.ico') ? 'image/x-icon' : 'application/octet-stream';
      try { return await sendFile(res, filePath, type); } catch (error) { if (error.code === 'ENOENT') return sendJson(res, 404, { message: 'Not found' }); throw error; }
    } catch (error) {
      const status = error.code === 'ENOENT' ? 404 : error.message?.startsWith('Only ') ? 400 : 500;
      return sendJson(res, status, { message: error.message || String(error) });
    }
  });
  await new Promise(resolve => httpServer.listen(PORT, '127.0.0.1', resolve));
  httpPort = httpServer.address().port;
  return httpPort;
}
function sendJson(res, status, value) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(value)); }
async function sendFile(res, filePath, contentType) { const data = await fs.readFile(filePath); res.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store', 'access-control-allow-origin': '*' }); res.end(data); }
function readBody(req) { return new Promise((resolve, reject) => { let data = ''; req.setEncoding('utf8'); req.on('data', chunk => { data += chunk; if (data.length > 4_000_000) reject(new Error('Request body too large')); }); req.on('end', () => resolve(data)); req.on('error', reject); }); }
function editorUrl(filePath, mode = 'preview') { return `http://127.0.0.1:${httpPort}/editor?path=${encodeURIComponent(filePath)}&mode=${encodeURIComponent(mode)}`; }
async function handleTool(name, args) {
  if (name === 'open_markdown_editor') {
    const data = await readMarkdown(args.path);
    await startHttp();
    return { content: [{ type: 'text', text: `SightMD opened ${data.path}` }], structuredContent: { ...data, mode: args.mode || 'preview', editorUrl: editorUrl(data.path, args.mode || 'preview') }, _meta: { 'openai/outputTemplate': 'ui://sightmd/editor.html', 'openai/widgetAccessible': true, editorUrl: editorUrl(data.path, args.mode || 'preview') } };
  }
  if (name === 'read_markdown') return { content: [{ type: 'text', text: JSON.stringify(await readMarkdown(args.path)) }], structuredContent: await readMarkdown(args.path) };
  if (name === 'write_markdown') {
    const filePath = assertMarkdown(args.path); const stat = await fs.stat(filePath);
    if (args.expectedMtimeMs != null && Math.abs(stat.mtimeMs - Number(args.expectedMtimeMs)) > 1) throw new Error('The file changed outside SightMD. Reload before saving.');
    await fs.writeFile(filePath, String(args.content ?? ''), 'utf8'); const next = await fs.stat(filePath);
    return { content: [{ type: 'text', text: `Saved ${filePath}` }], structuredContent: { path: filePath, mtimeMs: next.mtimeMs } };
  }
  throw new Error(`Unknown tool: ${name}`);
}
const tools = [
  { name: 'open_markdown_editor', description: 'Open a Markdown file in the SightMD Codex editor.', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Absolute path to a Markdown file' }, mode: { type: 'string', enum: ['preview', 'split', 'readonly'] } }, required: ['path'] } },
  { name: 'read_markdown', description: 'Read a Markdown file and return its content and mtime.', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'write_markdown', description: 'Write Markdown content back to a file with an optional mtime guard.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' }, expectedMtimeMs: { type: 'number' } }, required: ['path', 'content'] } }
];
async function handleRpc(message) {
  if (message.method === 'initialize') return jsonRpc(message.id, { protocolVersion: '2024-11-05', capabilities: { tools: {}, resources: {} }, serverInfo: { name: 'sightmd-codex', version: '0.1.0' } });
  if (message.method === 'notifications/initialized') return;
  if (message.method === 'tools/list') return jsonRpc(message.id, { tools });
  if (message.method === 'resources/list') return jsonRpc(message.id, { resources: [{ uri: 'ui://sightmd/editor.html', name: 'SightMD editor', mimeType: 'text/html;profile=mcp-app' }] });
  if (message.method === 'resources/read') {
    await startHttp();
    const html = await fs.readFile(path.join(APP_ROOT, 'index.html'), 'utf8');
    const injected = html.replace('<head>', `<head><base href="http://127.0.0.1:${httpPort}/">`).replace('<script>\n    window.__SIGHTMD_BOOTSTRAP__', `<script>\n    window.__SIGHTMD_BOOTSTRAP__`);
    return jsonRpc(message.id, { contents: [{ uri: 'ui://sightmd/editor.html', mimeType: 'text/html;profile=mcp-app', text: injected }] });
  }
  if (message.method === 'tools/call') {
    try { return jsonRpc(message.id, await handleTool(message.params?.name, message.params?.arguments || {})); }
    catch (error) { return jsonRpc(message.id, { isError: true, content: [{ type: 'text', text: error.message || String(error) }] }); }
  }
  if (message.id !== undefined) return jsonRpcError(message.id, -32601, `Method not found: ${message.method}`);
}
if (process.argv.includes('--http')) { await startHttp(); console.error(`SightMD listening on http://127.0.0.1:${httpPort}`); }
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', line => { if (!line.trim()) return; try { Promise.resolve(handleRpc(JSON.parse(line))).catch(error => console.error(error.stack || error)); } catch (error) { console.error(error.stack || error); } });
