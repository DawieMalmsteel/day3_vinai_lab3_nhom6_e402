/**
 * Vite Dev Server Plugin — Log Writer
 *
 * Thêm các endpoint API vào dev server để frontend có thể
 * ghi structured log, session, và comparison report ra thư mục logs/.
 *
 * Endpoints:
 *   POST /api/log/event     — ghi 1 dòng JSONL vào file session hiện tại
 *   POST /api/log/session   — lưu toàn bộ session (.jsonl + .json)
 *   POST /api/log/compare   — lưu comparison report (.md + .json)
 *   GET  /api/log/list      — liệt kê tất cả file trong logs/
 */

import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.resolve(process.cwd(), 'logs');

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function formatTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: string) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export default function loggerPlugin(): Plugin {
  // Trạng thái file đang ghi cho session hiện tại
  let currentJsonlFile: string | null = null;
  let currentSessionId: string | null = null;

  return {
    name: 'vite-plugin-logger',
    configureServer(server) {
      ensureLogsDir();

      server.middlewares.use(async (req, res, next) => {
        // ──────────── POST /api/log/event ────────────
        // Frontend gửi từng event → append vào file .jsonl
        if (req.method === 'POST' && req.url === '/api/log/event') {
          try {
            const raw = await readBody(req);
            const body = JSON.parse(raw);
            const { session_id, label, event } = body;

            // Nếu session mới → tạo file mới
            if (session_id && session_id !== currentSessionId) {
              currentSessionId = session_id;
              const ts = formatTimestamp();
              currentJsonlFile = path.join(LOGS_DIR, `session_${label}_${ts}.jsonl`);
              console.log(`\n📝 [logger] New session file: ${currentJsonlFile}`);
            }

            if (currentJsonlFile && event) {
              fs.appendFileSync(currentJsonlFile, JSON.stringify(event) + '\n', 'utf-8');
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, file: currentJsonlFile }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // ──────────── POST /api/log/session ────────────
        // Frontend gửi toàn bộ session khi kết thúc → lưu .jsonl + .json
        if (req.method === 'POST' && req.url === '/api/log/session') {
          try {
            const raw = await readBody(req);
            const session = JSON.parse(raw);
            const ts = formatTimestamp();
            const prefix = `session_${session.label}_${ts}`;

            // JSONL file (mỗi event 1 dòng)
            const jsonlPath = path.join(LOGS_DIR, `${prefix}.jsonl`);
            const jsonlContent = (session.events || [])
              .map((e: any) => JSON.stringify(e))
              .join('\n') + '\n';
            fs.writeFileSync(jsonlPath, jsonlContent, 'utf-8');

            // JSON file (pretty)
            const jsonPath = path.join(LOGS_DIR, `${prefix}.json`);
            fs.writeFileSync(jsonPath, JSON.stringify(session, null, 2), 'utf-8');

            console.log(`\n✅ [logger] Session saved:`);
            console.log(`   📄 ${jsonlPath}`);
            console.log(`   📄 ${jsonPath}`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, files: [jsonlPath, jsonPath] }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // ──────────── POST /api/log/compare ────────────
        // Frontend gửi comparison → lưu .md + .json
        if (req.method === 'POST' && req.url === '/api/log/compare') {
          try {
            const raw = await readBody(req);
            const body = JSON.parse(raw);
            const { summary, markdown } = body;
            const ts = formatTimestamp();
            const prefix = `compare_${ts}`;

            // Markdown
            const mdPath = path.join(LOGS_DIR, `${prefix}.md`);
            fs.writeFileSync(mdPath, markdown, 'utf-8');

            // JSON
            const jsonPath = path.join(LOGS_DIR, `${prefix}.json`);
            fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf-8');

            console.log(`\n📊 [logger] Comparison saved:`);
            console.log(`   📄 ${mdPath}`);
            console.log(`   📄 ${jsonPath}`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, files: [mdPath, jsonPath] }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // ──────────── GET /api/log/list ────────────
        // Liệt kê tất cả file log
        if (req.method === 'GET' && req.url === '/api/log/list') {
          try {
            const files = fs.readdirSync(LOGS_DIR)
              .filter(f => f.endsWith('.jsonl') || f.endsWith('.json') || f.endsWith('.md'))
              .map(f => ({
                name: f,
                size: fs.statSync(path.join(LOGS_DIR, f)).size,
                modified: fs.statSync(path.join(LOGS_DIR, f)).mtime.toISOString(),
              }))
              .sort((a, b) => b.modified.localeCompare(a.modified));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ files }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        next();
      });
    },
  };
}
