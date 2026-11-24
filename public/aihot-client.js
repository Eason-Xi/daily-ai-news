const DEFAULT_BASE_URL = 'https://aihot.news/api/v1';

const CATEGORY_MAP_TO_LOCAL = {
  'ai-models': 'model',
  'ai-products': 'agent',
  industry: 'industry',
  paper: 'opensource',
  tip: 'agent',
  opinion: 'safety'
};

const SECTION_LABEL_TO_LOCAL = [
  { regex: /模型/i, category: 'model' },
  { regex: /产品|应用|工具|Agent/i, category: 'agent' },
  { regex: /论文|开源|代码|研究/i, category: 'opensource' },
  { regex: /行业|产业|融资|算力|芯片/i, category: 'industry' },
  { regex: /安全|政策|观点|教程/i, category: 'safety' }
];

export const AIHOT_CATEGORY_LABELS = {
  'ai-models': 'AI 模型',
  'ai-products': 'AI 产品',
  industry: '行业动态',
  paper: '论文研究',
  tip: '教程实践',
  opinion: '观点评论'
};

export function inferLocalCategoryFromAihot(categorySlug, sectionLabel = '') {
  if (categorySlug && CATEGORY_MAP_TO_LOCAL[categorySlug]) {
    return CATEGORY_MAP_TO_LOCAL[categorySlug];
  }
  for (const rule of SECTION_LABEL_TO_LOCAL) {
    if (rule.regex.test(sectionLabel)) return rule.category;
  }
  return 'model';
}

/**
 * 将 AIHOT 的 item / 日报条目 / 事件报道转换为可收入精选简报册的标准文章对象。
 */
export function normalizeAihotItemToArticle(item, fallbackDate = '', sectionLabel = '') {
  if (!item || !item.title) return null;
  const originalUrl = item.links?.original || '';
  const aihotUrl = item.links?.aihot || item.attribution?.url || '';
  const url = originalUrl || aihotUrl || '';
  const publishedAt = item.publishedAt || item.discoveredAt || new Date().toISOString();
  const date = fallbackDate || (typeof publishedAt === 'string' && publishedAt.length >= 10 ? publishedAt.slice(0, 10) : '');
  const sourceName = item.source?.name || 'AIHOT';
  const category = inferLocalCategoryFromAihot(item.category, sectionLabel);

  return {
    id: item.id ? `aihot_${item.id}` : `aihot_${encodeURIComponent(item.title).slice(0, 24)}`,
    date,
    publishedAt,
    title: String(item.title).trim(),
    originalTitle: item.originalTitle ? String(item.originalTitle).trim() : null,
    summary: String(item.summary || item.reason || '').trim() || '来自 AIHOT 精选 AI 资讯。',
    url,
    aihotUrl,
    sourceId: 'aihot',
    sourceName,
    category,
    aihotCategory: item.category || null,
    score: Number.isFinite(item.score) ? item.score : null,
    reason: item.reason ? String(item.reason).trim() : '',
    lang: 'zh'
  };
}

/**
 * 创建带 ETag / If-None-Match 缓存与只读代理兜底的 AIHOT 客户端。
 */
export function createAihotClient({
  baseUrl = DEFAULT_BASE_URL,
  fallbackBaseUrl = '',
  fetchFn = globalThis.fetch,
  ttlMs = 60_000,
  nowFn = () => Date.now()
} = {}) {
  const cache = new Map();

  async function requestEndpoint(endpoint, customTtlMs = ttlMs) {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const targetUrl = `${cleanBase}${endpoint}`;
    const now = nowFn();
    const cached = cache.get(targetUrl);

    if (cached && now - cached.fetchedAt < customTtlMs) {
      return cached.data;
    }

    const headers = { Accept: 'application/json' };
    if (cached?.etag) {
      headers['If-None-Match'] = cached.etag;
    }

    try {
      const response = await fetchFn(targetUrl, { headers });
      if (response.status === 304 && cached) {
        cached.fetchedAt = now;
        return cached.data;
      }
      if (!response.ok) {
        throw new Error(`AIHOT HTTP ${response.status}`);
      }
      const data = await response.json();
      const etag = response.headers?.get?.('etag') || cached?.etag || null;
      cache.set(targetUrl, { etag, data, fetchedAt: now });
      return data;
    } catch (err) {
      if (fallbackBaseUrl) {
        const proxyUrl = `${fallbackBaseUrl}?endpoint=${encodeURIComponent(endpoint)}`;
        const proxyRes = await fetchFn(proxyUrl, { headers: { Accept: 'application/json' } });
        if (proxyRes.ok) {
          const data = await proxyRes.json();
          cache.set(targetUrl, { etag: null, data, fetchedAt: now });
          return data;
        }
      }
      if (cached) {
        return cached.data;
      }
      throw err;
    }
  }

  return {
    async getDailies() {
      return requestEndpoint('/dailies', Math.max(ttlMs, 180_000));
    },

    async getDaily(date = 'latest') {
      const target = String(date || 'latest').trim();
      if (target !== 'latest' && !/^\d{4}-\d{2}-\d{2}$/.test(target)) {
        throw new Error('无效的日报日期格式');
      }
      return requestEndpoint(`/dailies/${target}`, Math.max(ttlMs, 300_000));
    },

    async getWeeklies() {
      return requestEndpoint('/weeklies', Math.max(ttlMs, 300_000));
    },

    async getWeekly(week = 'latest') {
      const target = String(week || 'latest').trim();
      if (target !== 'latest' && !/^\d{4}-W\d{2}$/.test(target)) {
        throw new Error('无效的周报周期格式');
      }
      return requestEndpoint(`/weeklies/${target}`, Math.max(ttlMs, 300_000));
    },

    async getHotTopics() {
      return requestEndpoint('/hot-topics', ttlMs);
    },

    async getStory(publicId) {
      const id = String(publicId || '').trim();
      if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id)) {
        throw new Error('非法的事件 publicId');
      }
      return requestEndpoint(`/stories/${id}`, ttlMs);
    },

    async getItems({ mode = 'selected', window = '24h', category = '', q = '', limit = 30 } = {}) {
      const params = new URLSearchParams();
      params.set('mode', mode === 'all' ? 'all' : 'selected');
      params.set('window', window === '7d' ? '7d' : '24h');
      params.set('limit', String(Math.min(Math.max(Number(limit) || 30, 1), 30)));
      if (category && Object.hasOwn(AIHOT_CATEGORY_LABELS, category)) {
        params.set('category', category);
      }
      if (q && String(q).trim()) {
        params.set('q', String(q).trim());
      }
      return requestEndpoint(`/items?${params.toString()}`, ttlMs);
    },

    clearCache() {
      cache.clear();
    }
  };
}
