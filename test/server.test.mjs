import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

async function startServer() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sightmd-codex-'));
  const file = path.join(dir, 'sample.md');
  await fs.writeFile(file, '# Hello\n\nContent\n', 'utf8');
  const child = spawn(process.execPath, ['server.mjs'], { cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: ['pipe', 'pipe', 'pipe'] });
  let buffer = ''; const messages = [];
  child.stdout.setEncoding('utf8'); child.stdout.on('data', chunk => { buffer += chunk; for (const line of buffer.split('\n').slice(0, -1)) messages.push(JSON.parse(line)); buffer = buffer.slice(buffer.lastIndexOf('\n') + 1); });
  const call = (id, method, params) => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 3000); const check = setInterval(() => { const index = messages.findIndex(message => message.id === id); if (index >= 0) { clearInterval(check); clearTimeout(timer); resolve(messages.splice(index, 1)[0]); } }, 10); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  return { dir, file, child, call };
}

test('MCP lists SightMD tools and reads/writes Markdown', async t => {
  const server = await startServer(); t.after(() => server.child.kill());
  const init = await server.call(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {} });
  assert.equal(init.result.serverInfo.name, 'sightmd-codex');
  const listed = await server.call(2, 'tools/list', {});
  assert.deepEqual(listed.result.tools.map(tool => tool.name), ['open_markdown_editor', 'read_markdown', 'write_markdown']);
  const read = await server.call(3, 'tools/call', { name: 'read_markdown', arguments: { path: server.file } });
  assert.match(read.result.structuredContent.content, /# Hello/);
  const write = await server.call(4, 'tools/call', { name: 'write_markdown', arguments: { path: server.file, content: '# Updated\n' } });
  assert.match(write.result.content[0].text, /Saved/);
  assert.equal(await fs.readFile(server.file, 'utf8'), '# Updated\n');
});

test('rejects non-Markdown paths', async t => {
  const server = await startServer(); t.after(() => server.child.kill());
  const result = await server.call(5, 'tools/call', { name: 'read_markdown', arguments: { path: path.join(server.dir, 'data.txt') } });
  assert.equal(result.result.isError, true);
});
