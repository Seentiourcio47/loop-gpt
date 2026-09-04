#!/usr/bin/env node
/**
 * MCP selftest — acts as a real MCP client (same protocol LibreChat uses):
 * spawn /app/loop-mcp/media-server.mjs -> initialize -> tools/list ->
 * tools/call generate_image -> verify PNG magic bytes on disk.
 * Exit 0 = pass. Prints PASS/FAIL markers for CI-style assertions.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, statSync } from 'node:fs';

const SERVER = '/app/loop-mcp/media-server.mjs';
const proc = spawn('node', [SERVER], { stdio: ['pipe', 'pipe', 'inherit'] });

let buf = '';
let msgId = 0;
const pending = new Map();

proc.stdout.on('data', (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {}
  }
});

function rpc(method, params, timeoutMs = 240000) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`rpc timeout: ${method}`));
    }, timeoutMs);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

(async () => {
  const log = (...a) => console.log('[selftest]', ...a);

  const init = await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'loop-selftest', version: '0.1.0' },
  });
  log('initialized:', init.result?.serverInfo?.name, init.result?.serverInfo?.version ?? '');
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const tools = await rpc('tools/list', {});
  const names = (tools.result?.tools || []).map((t) => t.name);
  log('tools:', names.join(', '));
  if (!names.includes('generate_image')) throw new Error('generate_image tool missing');

  const call = await rpc(
    'tools/call',
    {
      name: 'generate_image',
      arguments: { prompt: 'A glossy red apple on a white studio background, product photography', width: 768, height: 768 },
    },
    300000
  );
  const content = call.result?.content || [];
  const imgPart = content.find((c) => c.type === 'image');
  const txtPart = content.find((c) => c.type === 'text');
  log('text part:', (txtPart?.text || '').slice(0, 120));

  if (!imgPart?.data) {
    console.log('[selftest] RESULT-FAIL no image content:', JSON.stringify(call.result).slice(0, 400));
    process.exit(3);
  }
  const png = Buffer.from(imgPart.data, 'base64');
  const magicOk = png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47;
  const out = '/tmp/selftest-image.png';
  writeFileSync(out, png);
  log(`saved ${out} bytes=${png.length} magicOK=${magicOk}`);

  // NOTE: video tool excluded from selftest (job can run 9+ min on cold endpoint);
  // verified separately via the UI acceptance flow.
  if (magicOk && png.length > 20000) {
    console.log('[selftest] RESULT-PASS image', png.length);
    process.exit(0);
  }
  console.log('[selftest] RESULT-FAIL small/invalid image');
  process.exit(4);
})().catch((e) => {
  console.error('[selftest] FATAL', e.message);
  process.exit(1);
});
