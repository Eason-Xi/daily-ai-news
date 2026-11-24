import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ArchiveStore } from '../lib/archive-store.mjs';
import {
  classifyArticle,
  decodeHtmlEntities,
  dedupeArticles,
  extractHotKeywords,
  isDeepArticleUrl,
  normalizeUrl,
  parseFeedXml,
  parseWebpageMeta,
  stripHtml,
  toDateKey
} from '../lib/rss-parser.mjs';
import { buildPagesSite } from '../scripts/build-pages.mjs';
import { createAppServer, isSafePublicHttpUrl } from '../server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

test('HTML 实体解码与脚本/标签清洗', () => {
  assert.equal(decodeHtmlEntities('OpenAI &amp; Claude &quot;3.7&quot; &#x2014; &#65;'), 'OpenAI & Claude "3.7" — A');
  const dirty = '<p>Hello <strong>AI</strong><script>alert(1)</script> world &nbsp; &amp; beyond!</p>';
  assert.equal(stripHtml(dirty, 100), 'Hello AI world & beyond!');
});

test('RSS 2.0 与 Atom 1.0 解析', () => {
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0"><channel><title>AI Feed</title>
      <item>
        <title><![CDATA[DeepSeek 发布新开源权重模型]]></title>
        <link>https://example.com/news/1?utm_source=rss&amp;id=42</link>
        <description><![CDATA[<p>支持百万上下文与高效推理。</p>]]></description>
        <pubDate>Tue, 24 Nov 2026 03:30:00 GMT</pubDate>
      </item>
    </channel></rss>`;

  const rssItems = parseFeedXml(rssXml, { id: 'test-rss', name: '测试RSS', lang: 'zh' });
  assert.equal(rssItems.length, 1);
  assert.equal(rssItems[0].title, 'DeepSeek 发布新开源权重模型');
  assert.equal(rssItems[0].url, 'https://example.com/news/1?id=42');
  assert.equal(rssItems[0].date, '2026-11-24');
  assert.equal(rssItems[0].summary, '支持百万上下文与高效推理。');

  const atomXml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>Anthropic launches new agentic workflow</title>
        <link rel="alternate" href="https://example.com/atom/agent"/>
        <updated>2026-11-23T18:00:00Z</updated>
        <summary>New desktop agent capabilities for developers.</summary>
      </entry>
    </feed>`;

  const atomItems = parseFeedXml(atomXml, { id: 'test-atom', name: 'Atom Source', lang: 'en' });
  assert.equal(atomItems.length, 1);
  assert.equal(atomItems[0].url, 'https://example.com/atom/agent');
  assert.equal(atomItems[0].date, '2026-11-24'); // UTC 18:00 -> Asia/Shanghai 次日 02:00
  assert.equal(atomItems[0].category, 'agent');
});

test('五维 AI 分类器准确性', () => {
  assert.equal(classifyArticle('Google DeepMind 发布 Gemini 4 Neon 模型', '强化推理能力'), 'model');
  assert.equal(classifyArticle('个人 AI 智能体小豆上线桌面端工作流', '自动处理日常日程'), 'agent');
  assert.equal(classifyArticle('前团队开源本地 Agent Linger，代码托管于 GitHub', '附带权重与论文'), 'opensource');
  assert.equal(classifyArticle('英伟达宣布黄仁勋复职 CEO，算力芯片股价飙升', '融资与估值'), 'industry');
  assert.equal(classifyArticle('联合国安理会探讨 AI 安全监管与零数据留存漏洞治理', '安全上限'), 'safety');
});

test('URL 规范化、去重、按日期转换及热词统计', () => {
  assert.equal(
    normalizeUrl('https://openai.com/blog/test/?utm_source=x&ref=hn&b=2&a=1'),
    'https://openai.com/blog/test?a=1&b=2'
  );
  assert.equal(toDateKey('2026-11-23T20:00:00Z', 'Asia/Shanghai'), '2026-11-24');

  const merged = dedupeArticles(
    [{ title: 'OpenAI 发布新模型', url: 'https://a.com/1?utm_source=rss', summary: '短摘要', publishedAt: '2026-11-24T01:00:00Z' }],
    [{ title: 'OpenAI 发布新模型', url: 'https://a.com/1', summary: '这是一段非常详细的完整中文核心导读内容。', publishedAt: '2026-11-24T02:00:00Z' }]
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].summary, '这是一段非常详细的完整中文核心导读内容。');

  const hot = extractHotKeywords([
    { title: 'OpenAI 提出 Perplexity 安全指标', summary: '' },
    { title: 'OpenAI 与 Cisco 开源 Shirudo', summary: '' },
    { title: 'Google Gemini 4 发布', summary: '' }
  ]);
  assert.equal(hot[0].word, 'OpenAI');
  assert.equal(hot[0].count, 2);
});

test('网页 Meta 提取与 SSRF 安全校验', () => {
  const html = `
    <html><head>
      <meta property="og:title" content="Test AI Breakthrough &amp; More" />
      <meta name="description" content="Detailed summary about foundation models." />
      <meta property="og:site_name" content="AI Journal" />
    </head></html>`;
  const meta = parseWebpageMeta(html, 'https://www.example.com/post/1');
  assert.equal(meta.title, 'Test AI Breakthrough & More');
  assert.equal(meta.summary, 'Detailed summary about foundation models.');
  assert.equal(meta.sourceName, 'AI Journal');

  assert.equal(isSafePublicHttpUrl('https://openai.com/news'), true);
  assert.equal(isSafePublicHttpUrl('http://127.0.0.1:3456/api/health'), false);
  assert.equal(isSafePublicHttpUrl('http://192.168.1.10/admin'), false);
  assert.equal(isSafePublicHttpUrl('http://localhost:8080'), false);
  assert.equal(isSafePublicHttpUrl('file:///etc/passwd'), false);

  assert.equal(isDeepArticleUrl('https://www.qbitai.com/2026/11/512330.html'), true);
  assert.equal(isDeepArticleUrl('https://openai.com/index/perplexity-and-intelligence'), true);
  assert.equal(isDeepArticleUrl('https://example.com/news/1?id=42'), true);
  assert.equal(isDeepArticleUrl('https://www.caixin.com/'), false);
  assert.equal(isDeepArticleUrl('https://openai.com/news'), false);
  assert.equal(isDeepArticleUrl('https://blog.google/technology/google-deepmind/'), false);
  assert.equal(isDeepArticleUrl('https://www.nvidia.com/en-us'), false);
});

test('ArchiveStore 与 HTTP API 端到端闭环测试', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'daily-ai-test-'));
  const archivePath = path.join(tmpDir, 'archive.json');
  const seedPath = path.join(ROOT_DIR, 'data', 'seed-daily.json');

  const store = new ArchiveStore({ archivePath, seedPath, autoSyncIntervalMinutes: 30 });
  const mockSources = async () => ({
    fetchedAt: '2026-11-24T12:00:00Z',
    sourceStatuses: [{ id: 'mock-hn', name: 'Mock HN', lang: 'en', status: 'ok', count: 1 }],
    articles: [
      {
        id: 'mock_sync_01',
        date: '2026-11-24',
        publishedAt: '2026-11-24T11:55:00+08:00',
        title: 'Mock Live Synced AI Agent News',
        summary: '增量抓取到的最新新闻',
        url: 'https://example.org/live-ai-agent',
        sourceId: 'mock-hn',
        sourceName: 'Mock HN',
        category: 'agent',
        lang: 'en'
      }
    ]
  });

  const server = createAppServer({
    archiveStore: store,
    publicDir: path.join(ROOT_DIR, 'public'),
    seedPath,
    fetchSourcesFn: mockSources
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1. 静态首页
    const homeRes = await fetch(`${baseUrl}/`);
    assert.equal(homeRes.status, 200);
    const homeHtml = await homeRes.text();
    assert.ok(homeHtml.includes('每日 AI 情报库'));

    // 2. 每日概览
    const daysRes = await fetch(`${baseUrl}/api/days`);
    assert.equal(daysRes.status, 200);
    const daysJson = await daysRes.json();
    assert.ok(daysJson.totalArticles >= 15);
    assert.ok(daysJson.days.some((d) => d.date === '2026-11-24'));

    // 3. 触发同步增量写入
    const syncRes = await fetch(`${baseUrl}/api/sync?date=2026-11-24`, { method: 'POST' });
    assert.equal(syncRes.status, 200);
    const syncJson = await syncRes.json();
    assert.equal(syncJson.sync.addedCount, 1);
    assert.ok(syncJson.dayDetail.articles.some((a) => a.title === 'Mock Live Synced AI Agent News'));

    // 4. 更新当日精选简报
    const putRes = await fetch(`${baseUrl}/api/day/curated`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-11-24',
        dailySummary: '今日 AI 焦点集中在端侧 Agent 与前沿推理模型。',
        items: [
          {
            id: 'mock_sync_01',
            title: 'Mock Live Synced AI Agent News',
            url: 'https://example.org/live-ai-agent',
            sourceName: 'Mock HN',
            category: 'agent',
            note: '值得持续关注'
          }
        ]
      })
    });
    assert.equal(putRes.status, 200);
    const putJson = await putRes.json();
    assert.equal(putJson.curated.items.length, 1);
    assert.equal(putJson.curated.items[0].note, '值得持续关注');

    // 5. 手动录入新情报
    const manualRes = await fetch(`${baseUrl}/api/day/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-11-24',
        title: '手工补充的 AI 芯片新进展',
        url: 'https://example.org/manual-chip',
        sourceName: '手动收集',
        category: 'industry',
        summary: '补充记录一条产业情报。',
        addToCurated: true
      })
    });
    assert.equal(manualRes.status, 200);
    const manualJson = await manualRes.json();
    assert.equal(manualJson.dayDetail.curated.items.length, 2);

    // 6. 跨日全部查询与全库导出
    const allRes = await fetch(`${baseUrl}/api/day?date=all`);
    assert.equal(allRes.status, 200);
    const allJson = await allRes.json();
    assert.ok(allJson.articles.length >= 17);

    const exportRes = await fetch(`${baseUrl}/api/export-archive`);
    assert.equal(exportRes.status, 200);
    const exportJson = await exportRes.json();
    assert.ok(exportJson.articlesByDate['2026-11-24'].length >= 8);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('buildPagesSite 静态站点与快照 API 构建测试', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'daily-ai-pages-'));
  const archivePath = path.join(tmpDir, 'archive.json');
  const outDir = path.join(tmpDir, '_site');
  const seedPath = path.join(ROOT_DIR, 'data', 'seed-daily.json');

  const store = new ArchiveStore({ archivePath, seedPath, autoSyncIntervalMinutes: 30 });
  try {
    const res = await buildPagesSite({
      archiveStore: store,
      publicDir: path.join(ROOT_DIR, 'public'),
      outDir
    });
    assert.ok(res.daysCount >= 3);
    assert.ok(res.totalArticles >= 15);

    const indexHtml = await readFile(path.join(outDir, 'index.html'), 'utf8');
    assert.ok(indexHtml.includes('每日 AI 情报库'));

    const nojekyll = await readFile(path.join(outDir, '.nojekyll'), 'utf8');
    assert.equal(nojekyll, '');

    const daysJson = JSON.parse(await readFile(path.join(outDir, 'api-static', 'days.json'), 'utf8'));
    assert.ok(daysJson.days.some((d) => d.date === '2026-11-24'));

    const day24 = JSON.parse(await readFile(path.join(outDir, 'api-static', 'days', '2026-11-24.json'), 'utf8'));
    assert.ok(day24.articles.length >= 1);

    const allJson = JSON.parse(await readFile(path.join(outDir, 'api-static', 'all.json'), 'utf8'));
    assert.ok(allJson.articles.length >= 15);

    const archiveDump = JSON.parse(await readFile(path.join(outDir, 'api-static', 'archive.json'), 'utf8'));
    assert.ok(archiveDump.articlesByDate['2026-11-24'].length >= 1);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
