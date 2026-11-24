import { createHash } from 'node:crypto';

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  middot: '·',
  bull: '•',
  copy: '©',
  reg: '®',
  trade: '™'
};

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'ref',
  'ref_src',
  'spm',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'igshid'
]);

const CATEGORY_RULES = [
  {
    category: 'model',
    keywords: [
      'gpt', 'claude', 'gemini', 'deepseek', 'qwen', 'llama', 'grok', 'mistral',
      'o1', 'o3', 'o4', 'sonnet', 'opus', 'haiku', 'neon', 'perplexity', 'cot',
      'reasoning', 'multimodal', 'pretraining', 'benchmark', 'llm', 'foundation model',
      '大模型', '基座模型', '前沿模型', '推理', '预训练', '思维链', '多模态',
      '上下文', '数学', '黎曼猜想', '困惑度', '能力评分', '通义', '文心', '混元', '豆包大模型'
    ]
  },
  {
    category: 'agent',
    keywords: [
      'agent', 'agentic', 'copilot', 'assistant', 'workflow', 'mcp', 'tool use',
      'computer use', 'browser use', 'cursor', 'devin', 'coding agent', 'workspace',
      '智能体', '个人助手', '小豆', '数字员工', '工作流', '桌面端', '自动化研发',
      '编程助手', '客服', 'sierra', '豆包主端', '办公'
    ]
  },
  {
    category: 'opensource',
    keywords: [
      'open source', 'open-source', 'open weight', 'github', 'hugging face', 'huggingface',
      'arxiv', 'paper', 'papers', 'weights', 'dataset', 'embodied', 'robotics', 'robot',
      'ebpf', 'linger', 'shirudo', 'wall-oss', '开源', '论文', '权重', '数据集',
      '具身', '机器人', '自变量', '源码', '零样本', '仓库', '模型社区'
    ]
  },
  {
    category: 'industry',
    keywords: [
      'ipo', 'nasdaq', 'funding', 'valuation', 'raises', 'raised', 'billion', 'million',
      'revenue', 'earnings', 'nvidia', 'jensen huang', 'chip', 'chips', 'gpu', 'hbm',
      'dram', 'compute', 'datacenter', 'acquisition', 'acquire', 'stock', 'market',
      'workday', 'c1.ai', '融资', '估值', '上市', '纳斯达克', '财报', '英伟达',
      '黄仁勋', '芯片', '算力', '收购', '董事会', '股价', '半导体', '基建', '现金流',
      '资金', '投资', '商业化'
    ]
  },
  {
    category: 'safety',
    keywords: [
      'safety', 'alignment', 'regulation', 'policy', 'governance', 'ethics', 'copyright',
      'leak', 'breach', 'vulnerability', 'security', 'zdr', 'openrouter', 'together ai',
      'superintelligence', 'risk', 'un security council', 'guardrail', 'cap', 'caps',
      '安全', '对齐', '监管', '政策', '治理', '伦理', '版权', '泄露', '外泄',
      '漏洞', '下架', '零数据留存', '联合国', '安理会', '上限', '超级智能', '失控', '风险'
    ]
  }
];

const HOT_ENTITY_PATTERNS = [
  { label: 'OpenAI', regex: /\bopenai\b/i },
  { label: 'Anthropic', regex: /\banthropic\b/i },
  { label: 'Claude', regex: /\bclaude\b/i },
  { label: 'Gemini', regex: /\bgemini(?:\s*\d+(?:\.\d+)?)?\b/i },
  { label: 'DeepSeek', regex: /\bdeepseek\b/i },
  { label: 'Qwen', regex: /\bqwen\b/i },
  { label: 'Meta', regex: /\bmeta\b/i },
  { label: 'Nvidia', regex: /\bnvidia\b|英伟达/i },
  { label: 'Agent', regex: /\bagent(?:s|ic)?\b|智能体/i },
  { label: '开源', regex: /\bopen[\s-]source\b|开源/i },
  { label: '具身智能', regex: /\bembodied\b|\brobot(?:ics|s)?\b|具身|机器人/i },
  { label: '算力与芯片', regex: /\bgpu\b|\bhbm\b|\bcompute\b|算力|芯片|半导体/i },
  { label: 'AI安全', regex: /\bsafety\b|\bsecurity\b|\balignment\b|安全|监管|治理|泄露/i },
  { label: '思维链', regex: /\bcot\b|chain[\s-]of[\s-]thought|思维链/i },
  { label: '超级智能', regex: /\bsuperintelligence\b|超级智能/i },
  { label: '大模型', regex: /\bllm(?:s)?\b|大模型|基础模型/i }
];

/**
 * 将时间输入格式化为指定时区的 YYYY-MM-DD 字符串。
 */
export function toDateKey(dateInput, timeZone = 'Asia/Shanghai', fallbackDate = new Date()) {
  let dateObj;
  if (dateInput instanceof Date) {
    dateObj = dateInput;
  } else if (typeof dateInput === 'number') {
    dateObj = new Date(dateInput);
  } else if (typeof dateInput === 'string' && dateInput.trim()) {
    const trimmed = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    dateObj = new Date(trimmed);
  } else {
    dateObj = fallbackDate;
  }

  if (Number.isNaN(dateObj.getTime())) {
    dateObj = fallbackDate;
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dateObj);
}

/**
 * 解码常见 HTML 命名实体与数字实体。
 */
export function decodeHtmlEntities(input) {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (full, entity) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return full;
        }
      }
      return full;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return full;
        }
      }
      return full;
    }
    const lower = entity.toLowerCase();
    return Object.hasOwn(NAMED_ENTITIES, lower) ? NAMED_ENTITIES[lower] : full;
  });
}

/**
 * 安全剥离 HTML 标签与脚本样式，清洗空白并截断到合理长度。
 */
export function stripHtml(html, maxLen = 240) {
  if (!html || typeof html !== 'string') return '';
  const cleaned = html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  const decoded = decodeHtmlEntities(cleaned)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!maxLen || decoded.length <= maxLen) {
    return decoded;
  }

  const slice = decoded.slice(0, maxLen);
  const lastBreak = Math.max(
    slice.lastIndexOf('。'),
    slice.lastIndexOf('！'),
    slice.lastIndexOf('？'),
    slice.lastIndexOf('. '),
    slice.lastIndexOf(' ')
  );
  const cut = lastBreak > maxLen * 0.55 ? slice.slice(0, lastBreak + 1) : slice;
  return `${cut.trim()}…`;
}

/**
 * 规范化 URL，去除追踪参数以便精准去重。
 */
export function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.searchParams.sort();
    parsed.hash = '';
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

const NON_ARTICLE_SLUGS = new Set([
  'news', 'blog', 'en-us', 'zh-cn', 'zh', 'en', 'feed', 'rss', 'index',
  'papers', 'securitycouncil', 'technology', 'google-deepmind', 'ai',
  'artificial-intelligence', 'category', 'topic', 'topics', 'articles', 'stories'
]);

/**
 * 判断 URL 是否指向具体单篇文章而非媒体首页或栏目入口。
 */
export function isDeepArticleUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  for (const key of ['id', 'p', 'article', 'story', 'post', 'v']) {
    if (parsed.searchParams.get(key)) return true;
  }

  const segments = parsed.pathname.split('/').filter(Boolean).map((s) => s.toLowerCase());
  if (segments.length === 0) return false;

  if (segments.every((seg) => NON_ARTICLE_SLUGS.has(seg))) {
    return false;
  }

  if (segments.length === 1) {
    const only = segments[0];
    if (NON_ARTICLE_SLUGS.has(only)) return false;
    return /\.(html?|shtml|pdf)$/i.test(only) || /\d{4,}/.test(only) || (only.includes('-') && only.length >= 12);
  }

  return true;
}

/**
 * 生成稳定短 ID。
 */
export function buildArticleId(url, sourceId, title) {
  const base = normalizeUrl(url) || `${sourceId || 'manual'}::${(title || '').trim().toLowerCase()}`;
  return `ai_${createHash('sha1').update(base).digest('hex').slice(0, 12)}`;
}

/**
 * 基于双语关键词权重对新闻进行五维分类。
 */
export function classifyArticle(title = '', summary = '', fallback = 'model') {
  const titleText = String(title || '').toLowerCase();
  const summaryText = String(summary || '').toLowerCase();
  const scores = new Map();

  for (const rule of CATEGORY_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      const needle = kw.toLowerCase();
      if (titleText.includes(needle)) {
        score += 3;
      } else if (summaryText.includes(needle)) {
        score += 1;
      }
    }
    scores.set(rule.category, score);
  }

  let bestCategory = fallback;
  let bestScore = 0;
  for (const [cat, score] of scores.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }

  return bestCategory;
}

function unwrapCdata(value) {
  if (!value) return '';
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function extractTagContent(block, tagNames) {
  for (const tagName of tagNames) {
    const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i');
    const match = block.match(regex);
    if (match && match[1]) {
      const content = unwrapCdata(match[1]);
      if (content) return content;
    }
  }
  return '';
}

function extractAtomLink(block) {
  const linkTags = [...block.matchAll(/<link\b([^>]*?)(?:\/>|>([\s\S]*?)<\/link>)/gi)];
  let fallbackHref = '';
  for (const match of linkTags) {
    const attrs = match[1] || '';
    const inner = unwrapCdata(match[2] || '');
    const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (hrefMatch && hrefMatch[1]) {
      const relMatch = attrs.match(/\brel\s*=\s*["']([^"']+)["']/i);
      const rel = relMatch ? relMatch[1].toLowerCase() : 'alternate';
      if (rel === 'alternate') {
        return decodeHtmlEntities(hrefMatch[1].trim());
      }
      if (!fallbackHref) {
        fallbackHref = decodeHtmlEntities(hrefMatch[1].trim());
      }
    } else if (inner && /^https?:\/\//i.test(inner)) {
      return decodeHtmlEntities(inner.trim());
    }
  }
  return fallbackHref;
}

function parseIsoTimestamp(rawDate, fallbackDate = new Date()) {
  if (!rawDate || typeof rawDate !== 'string') {
    return fallbackDate.toISOString();
  }
  const parsed = new Date(rawDate.trim());
  if (Number.isNaN(parsed.getTime())) {
    return fallbackDate.toISOString();
  }
  return parsed.toISOString();
}

/**
 * 解析 RSS 2.0 (<item>) 与 Atom 1.0 (<entry>) XML 字符串。
 */
export function parseFeedXml(xmlString, sourceMeta = {}) {
  if (!xmlString || typeof xmlString !== 'string') return [];

  const isAtom = /<feed\b[^>]*xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']|<entry\b/i.test(xmlString);
  const blockRegex = isAtom ? /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi : /<item\b[^>]*>([\s\S]*?)<\/item>/gi;

  const articles = [];
  const matches = xmlString.matchAll(blockRegex);

  for (const match of matches) {
    const block = match[1];
    const rawTitle = extractTagContent(block, ['title']);
    const title = stripHtml(rawTitle, 180);
    if (!title) continue;

    const rawLink = isAtom
      ? extractAtomLink(block) || decodeHtmlEntities(extractTagContent(block, ['id']))
      : decodeHtmlEntities(extractTagContent(block, ['link', 'guid'])) || extractAtomLink(block);
    const url = normalizeUrl(rawLink);
    if (!url || !isDeepArticleUrl(url)) continue;

    const rawSummary = extractTagContent(block, [
      'description',
      'summary',
      'content:encoded',
      'content'
    ]);
    const summary = stripHtml(rawSummary, 220) || '点击查看原文完整报道与技术细节。';

    const rawDate = extractTagContent(block, [
      'pubDate',
      'published',
      'updated',
      'dc:date',
      'date'
    ]);
    const publishedAt = parseIsoTimestamp(rawDate);
    const date = toDateKey(publishedAt);

    const sourceId = sourceMeta.id || 'rss';
    const sourceName = sourceMeta.name || 'AI 资讯源';
    const lang = sourceMeta.lang || (/[\u4e00-\u9fa5]/.test(title) ? 'zh' : 'en');
    const category = classifyArticle(title, summary, sourceMeta.defaultCategory || 'model');

    articles.push({
      id: buildArticleId(url, sourceId, title),
      date,
      publishedAt,
      title,
      summary,
      url,
      sourceId,
      sourceName,
      category,
      lang
    });
  }

  return articles;
}

export function titleFingerprint(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function mergeSingleArticle(prev, next) {
  const prevSummaryLen = (prev.summary || '').length;
  const nextSummaryLen = (next.summary || '').length;
  const useNextSummary = nextSummaryLen > prevSummaryLen && !next.summary.startsWith('点击查看原文');

  return {
    ...prev,
    ...next,
    id: prev.id || next.id,
    title: (prev.title && prev.title.length >= (next.title || '').length) ? prev.title : next.title,
    summary: useNextSummary ? next.summary : (prev.summary || next.summary),
    sourceName: prev.sourceName || next.sourceName,
    sourceId: prev.sourceId || next.sourceId,
    category: prev.category || next.category,
    publishedAt: prev.publishedAt || next.publishedAt,
    date: prev.date || next.date
  };
}

/**
 * 合并并去重文章列表（按规范化 URL 与标题指纹），按发布时间倒序排列。
 */
export function dedupeArticles(existingList = [], incomingList = []) {
  const byUrl = new Map();
  const byTitle = new Map();
  const ordered = [];

  for (const raw of [...existingList, ...incomingList]) {
    if (!raw || !raw.title) continue;
    const normUrl = normalizeUrl(raw.url || '');
    const fp = titleFingerprint(raw.title);
    const normalized = {
      ...raw,
      url: normUrl || raw.url || '',
      date: raw.date || toDateKey(raw.publishedAt),
      publishedAt: raw.publishedAt || new Date().toISOString(),
      id: raw.id || buildArticleId(normUrl, raw.sourceId, raw.title)
    };

    const existingIdx = (normUrl && byUrl.has(normUrl))
      ? byUrl.get(normUrl)
      : (fp && byTitle.has(fp) ? byTitle.get(fp) : -1);

    if (existingIdx >= 0) {
      ordered[existingIdx] = mergeSingleArticle(ordered[existingIdx], normalized);
    } else {
      const idx = ordered.length;
      ordered.push(normalized);
      if (normUrl) byUrl.set(normUrl, idx);
      if (fp) byTitle.set(fp, idx);
    }
  }

  ordered.sort((a, b) => {
    const tA = new Date(a.publishedAt).getTime() || 0;
    const tB = new Date(b.publishedAt).getTime() || 0;
    return tB - tA;
  });

  return ordered;
}

/**
 * 从当前文章列表标题与摘要提取高频热点关键词。
 */
export function extractHotKeywords(items = [], limit = 8) {
  const counts = new Map();
  for (const item of items) {
    const text = `${item.title || ''} ${item.summary || ''}`;
    for (const pattern of HOT_ENTITY_PATTERNS) {
      if (pattern.regex.test(text)) {
        counts.set(pattern.label, (counts.get(pattern.label) || 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

function matchMetaContent(html, attrName, attrValue) {
  const escapedVal = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const p1 = new RegExp(
    `<meta[^>]*\\b${attrName}\\s*=\\s*["']${escapedVal}["'][^>]*\\bcontent\\s*=\\s*["']([^"']*)["'][^>]*>`,
    'i'
  );
  const p2 = new RegExp(
    `<meta[^>]*\\bcontent\\s*=\\s*["']([^"']*)["'][^>]*\\b${attrName}\\s*=\\s*["']${escapedVal}["'][^>]*>`,
    'i'
  );
  const m1 = html.match(p1);
  if (m1 && m1[1]) return decodeHtmlEntities(m1[1].trim());
  const m2 = html.match(p2);
  if (m2 && m2[1]) return decodeHtmlEntities(m2[1].trim());
  return '';
}

/**
 * 解析任意网页 HTML 的标题、描述和站点名称。
 */
export function parseWebpageMeta(html, url) {
  let hostname = '外部资讯';
  try {
    hostname = new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    // ignore invalid url fallback
  }

  if (!html || typeof html !== 'string') {
    return {
      title: '',
      summary: '',
      sourceName: hostname,
      category: 'model'
    };
  }

  const ogTitle = matchMetaContent(html, 'property', 'og:title') ||
    matchMetaContent(html, 'name', 'twitter:title');
  const tagTitleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = ogTitle || (tagTitleMatch ? stripHtml(tagTitleMatch[1], 180) : '');

  const ogDesc = matchMetaContent(html, 'property', 'og:description') ||
    matchMetaContent(html, 'name', 'twitter:description') ||
    matchMetaContent(html, 'name', 'description');
  const summary = stripHtml(ogDesc, 220);

  const siteName = matchMetaContent(html, 'property', 'og:site_name') || hostname;
  const title = stripHtml(rawTitle, 180);

  return {
    title,
    summary,
    sourceName: stripHtml(siteName, 40) || hostname,
    category: classifyArticle(title, summary, 'model')
  };
}
