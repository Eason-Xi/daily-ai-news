import http from 'node:http';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArchiveStore } from './lib/archive-store.mjs';
import { parseWebpageMeta, toDateKey } from './lib/rss-parser.mjs';
import { fetchLiveSources } from './lib/sources.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

async function readJsonBody(req, maxBytes = 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error('请求体过大');
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  return JSON.parse(text);
}

/**
 * 校验 AIHOT 只读代理 endpoint 白名单，防止 SSRF 与路径穿透。
 */
export function isAllowedAihotEndpoint(rawEndpoint) {
  const endpoint = String(rawEndpoint || '').trim();
  if (!endpoint.startsWith('/') || endpoint.includes('..') || endpoint.includes('//')) {
    return false;
  }
  return /^\/(dailies(\/(\d{4}-\d{2}-\d{2}|latest))?|weeklies(\/(\d{4}-W\d{2}|latest))?|hot-topics|stories\/[a-zA-Z0-9_-]{8,64}|items(\?[a-zA-Z0-9_=&%.\-+]*)?)$/.test(endpoint);
}

/**
 * 防御 SSRF：仅允许公网 http/https 目标地址。
 */
export function isSafePublicHttpUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    return false;
  }

  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const parts = host.split('.').map(Number);
    if (
      parts[0] === 0 ||
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    ) {
      return false;
    }
  } else if (ipVersion === 6) {
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
      return false;
    }
  }

  return true;
}

export function createAppServer({
  archiveStore,
  publicDir = path.join(__dirname, 'public'),
  seedPath = path.join(__dirname, 'data', 'seed-daily.json'),
  fetchSourcesFn = fetchLiveSources
} = {}) {
  const store = archiveStore || new ArchiveStore({
    archivePath: path.join(__dirname, 'data', 'archive.json'),
    seedPath,
    autoSyncIntervalMinutes: 30
  });

  let syncInFlight = null;
  const aihotProxyCache = new Map();
  async function runSync() {
    if (syncInFlight) return syncInFlight;
    syncInFlight = (async () => {
      const live = await fetchSourcesFn();
      const merged = await store.mergeArticles(live.articles, {
        fetchedAt: live.fetchedAt,
        sourceStatuses: live.sourceStatuses
      });
      return {
        fetchedAt: live.fetchedAt,
        fetchedCount: live.articles.length,
        addedCount: merged.addedCount,
        touchedDates: merged.touchedDates,
        sourceStatuses: live.sourceStatuses
      };
    })().finally(() => {
      syncInFlight = null;
    });
    return syncInFlight;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
      const pathname = decodeURIComponent(reqUrl.pathname);

      if (req.method === 'GET' && pathname === '/api/health') {
        await store.init();
        return sendJson(res, 200, {
          ok: true,
          now: new Date().toISOString(),
          today: toDateKey(new Date())
        });
      }

      if (req.method === 'GET' && pathname === '/api/days') {
        const overview = await store.getDaysOverview();
        return sendJson(res, 200, overview);
      }

      if (req.method === 'GET' && pathname === '/api/day') {
        const dateParam = reqUrl.searchParams.get('date') || toDateKey(new Date());
        const detail = await store.getDayDetail(dateParam);
        return sendJson(res, 200, detail);
      }

      if (req.method === 'GET' && pathname === '/api/seed') {
        const raw = await readFile(seedPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(raw);
      }

      if (req.method === 'POST' && pathname === '/api/sync') {
        const syncResult = await runSync();
        const overview = await store.getDaysOverview();
        const activeDate = reqUrl.searchParams.get('date') || overview.today;
        const dayDetail = await store.getDayDetail(activeDate);
        return sendJson(res, 200, {
          sync: syncResult,
          overview,
          dayDetail
        });
      }

      if (req.method === 'PUT' && pathname === '/api/day/curated') {
        const body = await readJsonBody(req);
        const targetDate = body.date || toDateKey(new Date());
        const curated = await store.updateDayCurated(targetDate, body);
        const overview = await store.getDaysOverview();
        return sendJson(res, 200, {
          date: targetDate,
          curated,
          overview
        });
      }

      if (req.method === 'POST' && pathname === '/api/day/manual') {
        const body = await readJsonBody(req);
        const targetDate = body.date || toDateKey(new Date());
        const addToCurated = body.addToCurated !== false;
        const result = await store.addManualArticle(targetDate, body, addToCurated);
        const overview = await store.getDaysOverview();
        return sendJson(res, 200, {
          ...result,
          overview
        });
      }

      if (req.method === 'POST' && pathname === '/api/extract-url') {
        const body = await readJsonBody(req);
        const targetUrl = String(body.url || '').trim();
        if (!isSafePublicHttpUrl(targetUrl)) {
          return sendJson(res, 400, { error: '请输入合法的公开 http/https 文章链接' });
        }
        try {
          const response = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; DailyAINewsCollector/1.0)',
              Accept: 'text/html,application/xhtml+xml'
            },
            signal: AbortSignal.timeout(6000)
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const html = await response.text();
          const meta = parseWebpageMeta(html.slice(0, 200_000), targetUrl);
          return sendJson(res, 200, { ok: true, ...meta });
        } catch {
          const fallback = parseWebpageMeta('', targetUrl);
          return sendJson(res, 200, {
            ok: false,
            ...fallback,
            warning: '目标网站暂不支持自动提取或访问超时，已保留域名，请手动补充标题与摘要。'
          });
        }
      }

      if (req.method === 'GET' && pathname === '/api/aihot') {
        const endpoint = reqUrl.searchParams.get('endpoint') || '';
        if (!isAllowedAihotEndpoint(endpoint)) {
          return sendJson(res, 400, { error: '不支持的 AIHOT 接口路径' });
        }
        const targetUrl = `https://aihot.news/api/v1${endpoint}`;
        const now = Date.now();
        const cached = aihotProxyCache.get(targetUrl);
        if (cached && now - cached.fetchedAt < 60_000) {
          return sendJson(res, 200, cached.data);
        }
        const headers = {
          Accept: 'application/json',
          'User-Agent': 'DailyAINewsCollector/1.0 (+https://github.com/Eason-Xi/daily-ai-news)'
        };
        if (cached?.etag) {
          headers['If-None-Match'] = cached.etag;
        }
        try {
          const upstream = await fetch(targetUrl, {
            headers,
            signal: AbortSignal.timeout(8000)
          });
          if (upstream.status === 304 && cached) {
            cached.fetchedAt = now;
            return sendJson(res, 200, cached.data);
          }
          if (!upstream.ok) {
            return sendJson(res, upstream.status, { error: `AIHOT 上游返回 ${upstream.status}` });
          }
          const data = await upstream.json();
          const etag = upstream.headers.get('etag') || cached?.etag || null;
          aihotProxyCache.set(targetUrl, { etag, data, fetchedAt: now });
          return sendJson(res, 200, data);
        } catch (err) {
          if (cached) {
            return sendJson(res, 200, cached.data);
          }
          return sendJson(res, 502, { error: `请求 AIHOT 失败：${err?.message || '网络异常'}` });
        }
      }

      if (req.method === 'GET' && pathname === '/api/export-archive') {
        const dump = await store.exportFullArchive();
        const filename = `ai-news-archive-${toDateKey(new Date())}.json`;
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store'
        });
        return res.end(JSON.stringify(dump, null, 2));
      }

      // 静态资源托管
      if (req.method === 'GET' || req.method === 'HEAD') {
        const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
        const resolvedPublic = path.resolve(publicDir);
        const filePath = path.resolve(resolvedPublic, relPath);
        if (!filePath.startsWith(resolvedPublic + path.sep) && filePath !== resolvedPublic) {
          res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('Forbidden');
        }
        try {
          const content = await readFile(filePath);
          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Cache-Control': 'no-cache'
          });
          if (req.method === 'HEAD') return res.end();
          return res.end(content);
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('Not Found');
        }
      }

      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    } catch (err) {
      return sendJson(res, 500, { error: err?.message || '服务端内部错误' });
    }
  });

  server.runSync = runSync;
  server.store = store;
  return server;
}

const isDirectEntry = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectEntry) {
  const port = Number.parseInt(process.env.PORT || '3456', 10);
  const host = process.env.HOST || '127.0.0.1';
  const appServer = createAppServer();

  appServer.store.init().then(() => {
    appServer.listen(port, host, () => {
      console.log(`Daily AI News Collector running at http://${host}:${port}`);

      // 启动后非阻塞异步采集一次，不拖慢启动就绪
      setTimeout(() => {
        appServer.runSync().catch(() => {});
      }, 150).unref();

      // 每 30 分钟后台自动抓取归档每日 AI 新闻
      setInterval(() => {
        appServer.runSync().catch(() => {});
      }, 30 * 60 * 1000).unref();
    });
  });
}
