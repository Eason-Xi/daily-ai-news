import {
  buildArticleId,
  classifyArticle,
  isDeepArticleUrl,
  normalizeUrl,
  parseFeedXml,
  stripHtml,
  toDateKey
} from './rss-parser.mjs';

const AI_RELEVANCE_REGEX = /\b(ai|llm|gpt|claude|gemini|openai|anthropic|deepseek|qwen|llama|agent|agentic|robot|robotics|nvidia|gpu|chip|ml|machine learning|neural|transformer|copilot|perplexity|multimodal|rag)\b|人工智能|大模型|智能体|算力|芯片|英伟达|具身|机器人|开源模型|多模态|算法|深度学习|豆包|千问|混元/i;

export const NEWS_SOURCES = [
  {
    id: 'hn-ai',
    name: 'Hacker News AI',
    lang: 'en',
    type: 'json-hn',
    defaultCategory: 'opensource',
    homeUrl: 'https://news.ycombinator.com/',
    url: 'https://hn.algolia.com/api/v1/search_by_date?query=AI%20OR%20LLM%20OR%20OpenAI%20OR%20Anthropic%20OR%20Gemini%20OR%20DeepSeek&tags=story&hitsPerPage=25'
  },
  {
    id: 'hf-papers',
    name: 'Hugging Face Papers',
    lang: 'en',
    type: 'json-hf',
    defaultCategory: 'opensource',
    homeUrl: 'https://huggingface.co/papers',
    url: 'https://huggingface.co/api/daily_papers'
  },
  {
    id: 'arxiv-ai',
    name: 'arXiv cs.AI',
    lang: 'en',
    type: 'rss',
    defaultCategory: 'opensource',
    homeUrl: 'https://arxiv.org/list/cs.AI/recent',
    url: 'https://rss.arxiv.org/rss/cs.AI'
  },
  {
    id: 'openai-news',
    name: 'OpenAI News',
    lang: 'en',
    type: 'rss',
    defaultCategory: 'model',
    homeUrl: 'https://openai.com/news',
    url: 'https://openai.com/news/rss.xml'
  },
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch AI',
    lang: 'en',
    type: 'rss',
    defaultCategory: 'industry',
    homeUrl: 'https://techcrunch.com/category/artificial-intelligence/',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/'
  },
  {
    id: 'verge-ai',
    name: 'The Verge AI',
    lang: 'en',
    type: 'rss',
    defaultCategory: 'agent',
    homeUrl: 'https://www.theverge.com/ai-artificial-intelligence',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml'
  },
  {
    id: 'wired-ai',
    name: 'WIRED AI',
    lang: 'en',
    type: 'rss',
    defaultCategory: 'model',
    homeUrl: 'https://www.wired.com/tag/artificial-intelligence/',
    url: 'https://www.wired.com/feed/tag/ai/latest/rss'
  },
  {
    id: 'mit-ai',
    name: 'MIT Tech Review AI',
    lang: 'en',
    type: 'rss',
    defaultCategory: 'model',
    homeUrl: 'https://www.technologyreview.com/topic/artificial-intelligence/',
    url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed'
  },
  {
    id: 'qbitai',
    name: '量子位',
    lang: 'zh',
    type: 'rss',
    defaultCategory: 'agent',
    homeUrl: 'https://www.qbitai.com/',
    url: 'https://www.qbitai.com/feed'
  },
  {
    id: 'ifanr-ai',
    name: '爱范儿 AI 精选',
    lang: 'zh',
    type: 'rss',
    aiFilter: true,
    defaultCategory: 'agent',
    homeUrl: 'https://www.ifanr.com/',
    url: 'https://www.ifanr.com/feed'
  }
];

function parseHnPayload(json, source) {
  const hits = Array.isArray(json?.hits) ? json.hits : [];
  const items = [];
  for (const hit of hits) {
    const title = stripHtml(hit.title || hit.story_title || '', 180);
    if (!title) continue;
    const rawUrl = hit.url || hit.story_url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
    const url = normalizeUrl(rawUrl);
    const publishedAt = hit.created_at ? new Date(hit.created_at).toISOString() : new Date().toISOString();
    const summaryParts = [];
    if (hit.story_text) {
      summaryParts.push(stripHtml(hit.story_text, 180));
    }
    const points = Number.isFinite(hit.points) ? hit.points : 0;
    const comments = Number.isFinite(hit.num_comments) ? hit.num_comments : 0;
    summaryParts.push(`HN 社区讨论热度：${points} 赞 · ${comments} 条评论。`);
    const summary = summaryParts.join(' ');
    items.push({
      id: buildArticleId(url, source.id, title),
      date: toDateKey(publishedAt),
      publishedAt,
      title,
      summary,
      url,
      sourceId: source.id,
      sourceName: source.name,
      category: classifyArticle(title, summary, source.defaultCategory),
      lang: source.lang
    });
  }
  return items;
}

function parseHfPapersPayload(json, source) {
  const list = Array.isArray(json) ? json : [];
  const items = [];
  for (const entry of list.slice(0, 20)) {
    const paper = entry.paper || entry;
    const title = stripHtml(paper.title || entry.title || '', 180);
    if (!title || !paper.id) continue;
    const url = normalizeUrl(`https://huggingface.co/papers/${paper.id}`);
    const rawSummary = paper.summary || entry.summary || '';
    const summary = stripHtml(rawSummary, 220) || 'Hugging Face Daily Papers 今日热门 AI 研究论文。';
    const publishedAt = entry.publishedAt || paper.publishedAt || new Date().toISOString();
    const iso = Number.isNaN(new Date(publishedAt).getTime())
      ? new Date().toISOString()
      : new Date(publishedAt).toISOString();
    items.push({
      id: buildArticleId(url, source.id, title),
      date: toDateKey(iso),
      publishedAt: iso,
      title,
      summary,
      url,
      sourceId: source.id,
      sourceName: source.name,
      category: classifyArticle(title, summary, 'opensource'),
      lang: source.lang
    });
  }
  return items;
}

async function fetchOneSource(source, timeoutMs, maxAgeDays = 30, maxPerSource = 40) {
  const checkedAt = new Date().toISOString();
  const cutoffMs = maxAgeDays > 0 ? Date.now() - maxAgeDays * 86400 * 1000 : 0;
  try {
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'DailyAINewsCollector/1.0 (+https://localhost)',
        Accept: source.type.startsWith('json')
          ? 'application/json, text/plain, */*'
          : 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
      },
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    let articles = [];
    if (source.type === 'json-hn') {
      const json = await response.json();
      articles = parseHnPayload(json, source);
    } else if (source.type === 'json-hf') {
      const json = await response.json();
      articles = parseHfPapersPayload(json, source);
    } else {
      const xml = await response.text();
      articles = parseFeedXml(xml, source);
      if (source.aiFilter) {
        articles = articles.filter((art) => AI_RELEVANCE_REGEX.test(`${art.title} ${art.summary}`));
      }
    }

    articles = articles
      .filter((art) => isDeepArticleUrl(art.url))
      .filter((art) => {
        if (!cutoffMs) return true;
        const ts = new Date(art.publishedAt).getTime();
        return Number.isFinite(ts) && ts >= cutoffMs;
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, maxPerSource);

    return {
      articles,
      status: {
        id: source.id,
        name: source.name,
        lang: source.lang,
        homeUrl: source.homeUrl,
        status: 'ok',
        count: articles.length,
        checkedAt
      }
    };
  } catch (err) {
    return {
      articles: [],
      status: {
        id: source.id,
        name: source.name,
        lang: source.lang,
        homeUrl: source.homeUrl,
        status: 'unreachable',
        count: 0,
        error: err?.name === 'TimeoutError' ? '请求超时' : (err?.message || '连接失败'),
        checkedAt
      }
    };
  }
}

/**
 * 并发抓取所有真实 AI 信源，单源超时或失败互不阻塞。
 */
export async function fetchLiveSources({
  timeoutMs = 6500,
  sources = NEWS_SOURCES,
  maxAgeDays = 30,
  maxPerSource = 40
} = {}) {
  const settled = await Promise.allSettled(
    sources.map((src) => fetchOneSource(src, timeoutMs, maxAgeDays, maxPerSource))
  );
  const articles = [];
  const sourceStatuses = [];

  for (let i = 0; i < settled.length; i += 1) {
    const res = settled[i];
    const src = sources[i];
    if (res.status === 'fulfilled') {
      articles.push(...res.value.articles);
      sourceStatuses.push(res.value.status);
    } else {
      sourceStatuses.push({
        id: src.id,
        name: src.name,
        lang: src.lang,
        homeUrl: src.homeUrl,
        status: 'unreachable',
        count: 0,
        error: res.reason?.message || '抓取异常',
        checkedAt: new Date().toISOString()
      });
    }
  }

  return {
    articles,
    sourceStatuses,
    fetchedAt: new Date().toISOString()
  };
}
