const CATEGORY_LABELS = {
  model: '大模型与前沿',
  agent: 'Agent 与产品',
  opensource: '开源与论文',
  industry: '产业与资本',
  safety: '安全与政策'
};

const FALLBACK_SEED_ARTICLES = [
  {
    id: 'ai_8dc9facacc64',
    date: '2026-11-24',
    publishedAt: '2026-11-24T03:30:46.000Z',
    title: '蚂蚁OceanBase发布湖库一体AI数据平台OceanLake，核心引擎向全球开源',
    summary: '中国AI数据平台加速崛起',
    url: 'https://www.qbitai.com/2026/11/512330.html',
    sourceId: 'qbitai',
    sourceName: '量子位',
    category: 'opensource',
    lang: 'zh'
  },
  {
    id: 'ai_43b498f2b7e3',
    date: '2026-11-24',
    publishedAt: '2026-11-23T22:05:50.000Z',
    title: 'Anthropic launches Claude Ship, letting AI agents review, fix, and approve code changes',
    summary: "As AI-generated code piles up, Anthropic's new developer tools aim to eliminate another bottleneck by letting agents handle routine approvals.",
    url: 'https://techcrunch.com/2026/11/23/anthropic-launches-claude-ship-letting-ai-agents-review-fix-and-approve-code-changes',
    sourceId: 'techcrunch-ai',
    sourceName: 'TechCrunch AI',
    category: 'model',
    lang: 'en'
  },
  {
    id: 'ai_1d0c151fefed',
    date: '2026-11-24',
    publishedAt: '2026-11-23T21:20:00.000Z',
    title: 'OpenAI and Cisco introduce Shirudo',
    summary: 'OpenAI and Cisco introduce Shirudo, an open-source runtime for Linux. It helps teams protect running systems while they roll out patches.',
    url: 'https://openai.com/index/introducing-shirudo',
    sourceId: 'openai-news',
    sourceName: 'OpenAI News',
    category: 'opensource',
    lang: 'en'
  },
  {
    id: 'ai_de5cd1a6d51d',
    date: '2026-11-22',
    publishedAt: '2026-11-22T00:00:00.000Z',
    title: 'Perplexity and Intelligence',
    summary: 'How perplexity measures progress in AI models, and why it could help developers establish a shared approach to evaluating emerging capabilities.',
    url: 'https://openai.com/index/perplexity-and-intelligence',
    sourceId: 'openai-news',
    sourceName: 'OpenAI News',
    category: 'model',
    lang: 'en'
  }
];

const LOCAL_STORAGE_KEY = 'daily_ai_archive_fallback_v1';
const THEME_STORAGE_KEY = 'daily_ai_theme_v1';

const state = {
  mode: 'server', // 'server' | 'pages' | 'offline'
  today: getLocalDateKey(new Date()),
  selectedDate: getLocalDateKey(new Date()),
  daysOverview: [],
  pagesBaseOverview: null,
  totalDays: 0,
  totalArticles: 0,
  meta: { lastSyncAt: null, autoSyncIntervalMinutes: 30, sourceStatuses: [] },
  articles: [],
  hotKeywords: [],
  curated: { dailySummary: '', items: [] },
  filters: {
    category: 'all',
    lang: 'all',
    source: 'all',
    search: '',
    keyword: ''
  },
  exportFormat: 'markdown',
  summarySaveTimer: null
};

const els = {
  daemonStatusText: document.getElementById('daemonStatusText'),
  runtimeModeBadge: document.getElementById('runtimeModeBadge'),
  todayMetaLine: document.getElementById('todayMetaLine'),
  statTotalDays: document.getElementById('statTotalDays'),
  statTotalArticles: document.getElementById('statTotalArticles'),
  statOnlineSources: document.getElementById('statOnlineSources'),
  openManualModalBtn: document.getElementById('openManualModalBtn'),
  syncNowBtn: document.getElementById('syncNowBtn'),
  syncBtnLabel: document.getElementById('syncBtnLabel'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  timelineChips: document.getElementById('timelineChips'),
  datePickerInput: document.getElementById('datePickerInput'),
  allDaysToggleBtn: document.getElementById('allDaysToggleBtn'),
  categoryTabs: document.getElementById('categoryTabs'),
  langFilterSelect: document.getElementById('langFilterSelect'),
  sourceFilterSelect: document.getElementById('sourceFilterSelect'),
  searchInput: document.getElementById('searchInput'),
  hotChips: document.getElementById('hotChips'),
  feedHeading: document.getElementById('feedHeading'),
  feedSubheading: document.getElementById('feedSubheading'),
  newsList: document.getElementById('newsList'),
  briefSidebar: document.getElementById('briefSidebar'),
  mobileOpenBriefBtn: document.getElementById('mobileOpenBriefBtn'),
  mobileCloseBriefBtn: document.getElementById('mobileCloseBriefBtn'),
  mobileBriefCount: document.getElementById('mobileBriefCount'),
  briefPanelTitle: document.getElementById('briefPanelTitle'),
  briefPanelMeta: document.getElementById('briefPanelMeta'),
  dailySummaryInput: document.getElementById('dailySummaryInput'),
  curatedList: document.getElementById('curatedList'),
  openExportModalBtn: document.getElementById('openExportModalBtn'),
  downloadArchiveBtn: document.getElementById('downloadArchiveBtn'),
  clearDayBriefBtn: document.getElementById('clearDayBriefBtn'),
  lastSyncText: document.getElementById('lastSyncText'),
  sourceRadarList: document.getElementById('sourceRadarList'),
  manualModal: document.getElementById('manualModal'),
  manualForm: document.getElementById('manualForm'),
  manualUrlInput: document.getElementById('manualUrlInput'),
  extractUrlBtn: document.getElementById('extractUrlBtn'),
  extractStatusHint: document.getElementById('extractStatusHint'),
  manualDateInput: document.getElementById('manualDateInput'),
  manualCategorySelect: document.getElementById('manualCategorySelect'),
  manualTitleInput: document.getElementById('manualTitleInput'),
  manualSourceInput: document.getElementById('manualSourceInput'),
  manualSummaryInput: document.getElementById('manualSummaryInput'),
  manualNoteInput: document.getElementById('manualNoteInput'),
  manualAddCuratedCheck: document.getElementById('manualAddCuratedCheck'),
  exportModal: document.getElementById('exportModal'),
  exportModalSubtitle: document.getElementById('exportModalSubtitle'),
  exportPreviewArea: document.getElementById('exportPreviewArea'),
  exportIncludeAllFallback: document.getElementById('exportIncludeAllFallback'),
  downloadMdBtn: document.getElementById('downloadMdBtn'),
  copyExportBtn: document.getElementById('copyExportBtn'),
  toastRegion: document.getElementById('toastRegion')
};

function getLocalDateKey(dateObj = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dateObj);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeHref(url) {
  try {
    const parsed = new URL(String(url || '').trim());
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // fallback
  }
  return '#';
}

function showToast(message) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  els.toastRegion.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  setTimeout(() => {
    node.classList.remove('is-visible');
    setTimeout(() => node.remove(), 220);
  }, 2600);
}

function formatDayChipLabel(dateKey) {
  if (dateKey === state.today) return `今天 ${dateKey.slice(5)}`;
  const todayMs = new Date(`${state.today}T00:00:00`).getTime();
  const targetMs = new Date(`${dateKey}T00:00:00`).getTime();
  const diffDays = Math.round((todayMs - targetMs) / 86400000);
  if (diffDays === 1) return `昨天 ${dateKey.slice(5)}`;
  if (diffDays === 2) return `前天 ${dateKey.slice(5)}`;
  return dateKey.slice(5);
}

function formatArticleTime(isoString, includeDate = false) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const hhmm = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  if (includeDate) {
    return `${getLocalDateKey(date)} ${hhmm}`;
  }
  return hhmm;
}

function getActiveCuratedDate() {
  return state.selectedDate === 'all' ? state.today : state.selectedDate;
}

/* ---------- 浅色 / 深色主题 ---------- */
function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
  showToast(next === 'dark' ? '已切换至深色石墨主题' : '已切换至浅色纸张主题');
}

/* ---------- 本地浏览器缓存（Pages 访客精选与离线模式共用） ---------- */
function readLocalBrowserStore(seedFallback = false) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  const articlesByDate = {};
  if (seedFallback) {
    for (const item of FALLBACK_SEED_ARTICLES) {
      if (!articlesByDate[item.date]) articlesByDate[item.date] = [];
      articlesByDate[item.date].push(item);
    }
  }
  return {
    meta: { lastSyncAt: null, autoSyncIntervalMinutes: 30, sourceStatuses: [] },
    articlesByDate,
    curatedByDate: {}
  };
}

function writeLocalBrowserStore(store) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota error
  }
}

/* ---------- API 数据加载与同步 ---------- */
async function apiFetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP ${res.status}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json') && !url.endsWith('.json')) {
    throw new Error('非 JSON 响应');
  }
  return res.json();
}

async function loadInitialData() {
  if (window.location.protocol === 'file:') {
    activateOfflineMode();
    return;
  }

  try {
    const overview = await apiFetchJson('./api/days');
    state.mode = 'server';
    els.runtimeModeBadge.hidden = true;
    els.daemonStatusText.textContent = '每日 AI 情报持续归档守护中';
    applyOverview(overview);
    if (!state.selectedDate) state.selectedDate = state.today;
    await loadDay(state.selectedDate);
    return;
  } catch {
    // try GitHub Pages static snapshot mode
  }

  try {
    const staticOverview = await apiFetchJson('./api-static/days.json');
    await activatePagesMode(staticOverview);
  } catch {
    activateOfflineMode();
  }
}

function buildPagesOverviewWithLocal(baseOverview) {
  const localStore = readLocalBrowserStore(false);
  const localDaysMap = new Map((baseOverview.days || []).map((d) => [d.date, { ...d }]));

  for (const [dateKey, list] of Object.entries(localStore.articlesByDate || {})) {
    if (!localDaysMap.has(dateKey)) {
      localDaysMap.set(dateKey, { date: dateKey, count: 0, curatedCount: 0, hasSummary: false });
    }
    const entry = localDaysMap.get(dateKey);
    entry.count += list.length;
  }

  for (const [dateKey, curated] of Object.entries(localStore.curatedByDate || {})) {
    if (!localDaysMap.has(dateKey)) {
      localDaysMap.set(dateKey, { date: dateKey, count: 0, curatedCount: 0, hasSummary: false });
    }
    const entry = localDaysMap.get(dateKey);
    entry.curatedCount = Array.isArray(curated?.items) ? curated.items.length : 0;
    entry.hasSummary = Boolean(curated?.dailySummary?.trim());
  }

  const days = [...localDaysMap.values()].sort((a, b) => b.date.localeCompare(a.date));
  return {
    ...baseOverview,
    days,
    totalDays: days.filter((d) => d.count > 0 || d.curatedCount > 0).length,
    totalArticles: days.reduce((s, d) => s + d.count, 0)
  };
}

async function activatePagesMode(staticOverview) {
  state.mode = 'pages';
  state.pagesBaseOverview = staticOverview;
  els.runtimeModeBadge.hidden = false;
  els.runtimeModeBadge.textContent = 'GitHub Pages 云端归档';
  els.daemonStatusText.textContent = '由 GitHub Actions 每日定时自动采集更新';
  applyOverview(buildPagesOverviewWithLocal(staticOverview));
  if (!state.selectedDate) state.selectedDate = state.today;
  await loadDay(state.selectedDate);
}

function activateOfflineMode() {
  state.mode = 'offline';
  els.runtimeModeBadge.hidden = false;
  els.runtimeModeBadge.textContent = '本地静态模式';
  els.daemonStatusText.textContent = '浏览器离线直连模式（数据存于本机浏览器）';
  const store = readLocalBrowserStore(true);
  const dateSet = new Set([state.today, ...Object.keys(store.articlesByDate)]);
  const days = [...dateSet].sort((a, b) => b.localeCompare(a)).map((date) => ({
    date,
    count: (store.articlesByDate[date] || []).length,
    curatedCount: (store.curatedByDate[date]?.items || []).length
  }));
  applyOverview({
    today: state.today,
    days,
    totalDays: days.filter((d) => d.count > 0 || d.curatedCount > 0).length,
    totalArticles: days.reduce((s, d) => s + d.count, 0),
    meta: store.meta
  });
  loadOfflineDay(state.selectedDate);
}

function mergeDistinctClientArticles(primary = [], secondary = []) {
  const seen = new Set();
  const merged = [];
  for (const item of [...primary, ...secondary]) {
    if (!item || !item.title) continue;
    const key = item.url || item.id || item.title;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function loadOfflineDay(dateKey) {
  const store = readLocalBrowserStore(true);
  if (dateKey === 'all') {
    state.articles = Object.values(store.articlesByDate)
      .flat()
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    state.curated = store.curatedByDate[state.today] || { dailySummary: '', items: [] };
  } else {
    state.articles = (store.articlesByDate[dateKey] || [])
      .slice()
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    state.curated = store.curatedByDate[dateKey] || { dailySummary: '', items: [] };
  }
  state.hotKeywords = computeClientKeywords(state.articles);
  renderAll();
}

function computeClientKeywords(items) {
  const words = ['OpenAI', 'DeepSeek', 'Gemini', 'Claude', 'Nvidia', 'Agent', '开源', '具身智能'];
  return words
    .map((w) => ({
      word: w,
      count: items.filter((a) => `${a.title} ${a.summary}`.toLowerCase().includes(w.toLowerCase())).length
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function applyOverview(overview) {
  state.today = overview.today || getLocalDateKey(new Date());
  state.daysOverview = Array.isArray(overview.days) ? overview.days : [];
  state.totalDays = overview.totalDays || 0;
  state.totalArticles = overview.totalArticles || 0;
  state.meta = overview.meta || state.meta;
}

async function loadDay(dateKey) {
  state.selectedDate = dateKey;
  state.filters.source = 'all';
  state.filters.keyword = '';

  if (state.mode === 'offline') {
    loadOfflineDay(dateKey);
    return;
  }

  if (state.mode === 'pages') {
    const localStore = readLocalBrowserStore(false);
    let remoteDetail = { articles: [], hotKeywords: [] };
    try {
      const targetUrl = dateKey === 'all'
        ? './api-static/all.json'
        : `./api-static/days/${encodeURIComponent(dateKey)}.json`;
      remoteDetail = await apiFetchJson(targetUrl);
    } catch {
      remoteDetail = { articles: [], hotKeywords: [] };
    }
    const localArticles = dateKey === 'all'
      ? Object.values(localStore.articlesByDate || {}).flat()
      : (localStore.articlesByDate?.[dateKey] || []);
    state.articles = mergeDistinctClientArticles(remoteDetail.articles || [], localArticles);
    state.hotKeywords = Array.isArray(remoteDetail.hotKeywords) && remoteDetail.hotKeywords.length > 0
      ? remoteDetail.hotKeywords
      : computeClientKeywords(state.articles);
    const curatedKey = dateKey === 'all' ? state.today : dateKey;
    state.curated = localStore.curatedByDate?.[curatedKey] || { dailySummary: '', items: [] };
    renderAll();
    return;
  }

  const detail = await apiFetchJson(`./api/day?date=${encodeURIComponent(dateKey)}`);
  state.articles = Array.isArray(detail.articles) ? detail.articles : [];
  state.hotKeywords = Array.isArray(detail.hotKeywords) ? detail.hotKeywords : [];
  state.curated = detail.curated || { dailySummary: '', items: [] };
  renderAll();
}

async function triggerSyncNow() {
  els.syncNowBtn.disabled = true;
  els.syncNowBtn.classList.add('is-spinning');
  els.syncBtnLabel.textContent = '采集中…';

  try {
    if (state.mode !== 'server') {
      const res = await fetch('https://hn.algolia.com/api/v1/search_by_date?query=AI%20OR%20LLM%20OR%20OpenAI&tags=story&hitsPerPage=15');
      const json = await res.json();
      const store = readLocalBrowserStore(state.mode === 'offline');
      const incoming = (json.hits || []).map((hit) => {
        const pub = hit.created_at || new Date().toISOString();
        const dKey = getLocalDateKey(new Date(pub));
        return {
          id: `hn_${hit.objectID}`,
          date: dKey,
          publishedAt: pub,
          title: hit.title || 'Hacker News AI Story',
          summary: `HN 社区讨论热度：${hit.points || 0} 赞 · ${hit.num_comments || 0} 评论。`,
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          sourceId: 'hn-ai',
          sourceName: 'Hacker News AI',
          category: 'opensource',
          lang: 'en'
        };
      });
      for (const art of incoming) {
        if (!store.articlesByDate[art.date]) store.articlesByDate[art.date] = [];
        if (!store.articlesByDate[art.date].some((x) => x.url === art.url)) {
          store.articlesByDate[art.date].unshift(art);
        }
      }
      store.meta.lastSyncAt = new Date().toISOString();
      writeLocalBrowserStore(store);
      if (state.mode === 'pages' && state.pagesBaseOverview) {
        await activatePagesMode(state.pagesBaseOverview);
      } else {
        activateOfflineMode();
      }
      showToast(`已直连同步 ${incoming.length} 条最新 AI 资讯`);
      return;
    }

    const result = await apiFetchJson(`./api/sync?date=${encodeURIComponent(state.selectedDate)}`, {
      method: 'POST'
    });
    applyOverview(result.overview);
    state.articles = result.dayDetail?.articles || [];
    state.hotKeywords = result.dayDetail?.hotKeywords || [];
    state.curated = result.dayDetail?.curated || state.curated;
    renderAll();

    const okSources = (result.sync?.sourceStatuses || []).filter((s) => s.status === 'ok').length;
    showToast(`同步完成：在线信源 ${okSources} 个，新增归档 ${result.sync?.addedCount || 0} 条`);
  } catch (err) {
    showToast(`采集同步失败：${err.message}`);
  } finally {
    els.syncNowBtn.disabled = false;
    els.syncNowBtn.classList.remove('is-spinning');
    els.syncBtnLabel.textContent = '立即采集今日';
  }
}

/* ---------- 精选收集箱持久化 ---------- */
async function persistCurated() {
  const targetDate = getActiveCuratedDate();

  if (state.mode !== 'server') {
    const store = readLocalBrowserStore(state.mode === 'offline');
    store.curatedByDate[targetDate] = state.curated;
    writeLocalBrowserStore(store);
    const dayObj = state.daysOverview.find((d) => d.date === targetDate);
    if (dayObj) dayObj.curatedCount = state.curated.items.length;
    renderTimeline();
    return;
  }

  try {
    const res = await apiFetchJson('./api/day/curated', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: targetDate,
        dailySummary: state.curated.dailySummary || '',
        items: state.curated.items || []
      })
    });
    state.curated = res.curated;
    if (res.overview) applyOverview(res.overview);
    renderTimeline();
  } catch (err) {
    showToast(`保存简报失败：${err.message}`);
  }
}

function isArticleCollected(article) {
  return (state.curated.items || []).some(
    (c) => c.id === article.id || (c.url && article.url && c.url === article.url)
  );
}

function toggleCollectArticle(article) {
  const items = [...(state.curated.items || [])];
  const idx = items.findIndex(
    (c) => c.id === article.id || (c.url && article.url && c.url === article.url)
  );

  if (idx >= 0) {
    items.splice(idx, 1);
    showToast('已从当日简报移出');
  } else {
    items.unshift({
      ...article,
      note: '',
      savedAt: new Date().toISOString()
    });
    showToast('已收入当日简报册');
  }

  state.curated = { ...state.curated, items };
  renderNewsList();
  renderCuratedPanel();
  persistCurated();
}

function moveCuratedItem(index, delta) {
  const items = [...(state.curated.items || [])];
  const target = index + delta;
  if (target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
  state.curated = { ...state.curated, items };
  renderCuratedPanel();
  persistCurated();
}

function removeCuratedItem(index) {
  const items = [...(state.curated.items || [])];
  items.splice(index, 1);
  state.curated = { ...state.curated, items };
  renderNewsList();
  renderCuratedPanel();
  persistCurated();
}

/* ---------- 渲染视图 ---------- */
function renderAll() {
  renderMasthead();
  renderTimeline();
  renderSourceSelectAndRadar();
  renderHotKeywords();
  renderNewsList();
  renderCuratedPanel();
}

function renderMasthead() {
  const now = new Date();
  const weekday = now.toLocaleDateString('zh-CN', { weekday: 'long' });
  const syncTxt = state.meta?.lastSyncAt
    ? `上次自动同步：${formatArticleTime(state.meta.lastSyncAt, true)}`
    : '已加载每日预置归档库 · 点击「立即采集今日」获取全网最新动态';

  els.todayMetaLine.textContent = `${state.today} ${weekday} · ${syncTxt}`;
  els.statTotalDays.textContent = `${state.totalDays} 天`;
  els.statTotalArticles.textContent = `${state.totalArticles} 条`;

  const statuses = state.meta?.sourceStatuses || [];
  if (statuses.length > 0) {
    const okCount = statuses.filter((s) => s.status === 'ok').length;
    els.statOnlineSources.textContent = `${okCount} / ${statuses.length}`;
  } else {
    els.statOnlineSources.textContent = '10 源就绪';
  }
}

function renderTimeline() {
  const html = state.daysOverview
    .slice(0, 14)
    .map((day) => {
      const isActive = state.selectedDate === day.date;
      const starHtml = day.curatedCount > 0
        ? `<span class="day-chip-star">★${day.curatedCount}</span>`
        : '';
      return `
        <button
          type="button"
          class="day-chip ${isActive ? 'is-active' : ''}"
          data-date-chip="${escapeHtml(day.date)}"
          role="tab"
          aria-selected="${isActive}"
        >
          <span>${escapeHtml(formatDayChipLabel(day.date))}</span>
          <span class="day-chip-meta">${day.count}条</span>
          ${starHtml}
        </button>
      `;
    })
    .join('');

  els.timelineChips.innerHTML = html;
  els.datePickerInput.value = state.selectedDate === 'all' ? state.today : state.selectedDate;
  els.allDaysToggleBtn.classList.toggle('is-active', state.selectedDate === 'all');
}

function renderSourceSelectAndRadar() {
  const countsInView = new Map();
  const namesMap = new Map();

  for (const art of state.articles) {
    const sid = art.sourceId || art.sourceName;
    countsInView.set(sid, (countsInView.get(sid) || 0) + 1);
    namesMap.set(sid, art.sourceName);
  }

  const statuses = state.meta?.sourceStatuses || [];
  for (const st of statuses) {
    if (!namesMap.has(st.id)) namesMap.set(st.id, st.name);
  }

  const currentSelect = state.filters.source;
  const options = ['<option value="all">全部信源</option>'];
  for (const [sid, sname] of namesMap.entries()) {
    const count = countsInView.get(sid) || 0;
    options.push(
      `<option value="${escapeHtml(sid)}" ${currentSelect === sid ? 'selected' : ''}>${escapeHtml(sname)} (${count})</option>`
    );
  }
  els.sourceFilterSelect.innerHTML = options.join('');

  els.lastSyncText.textContent = state.meta?.lastSyncAt
    ? `最近采集 ${formatArticleTime(state.meta.lastSyncAt, false)} · 点击可过滤`
    : '点击信源可快速筛选 · 服务端每 30 分钟自动同步';

  if (statuses.length === 0) {
    const fallbackRows = [...namesMap.entries()].map(([sid, sname]) => `
      <li class="source-row ${currentSelect === sid ? 'is-selected' : ''}" data-source-id="${escapeHtml(sid)}">
        <span class="source-row-left">
          <span class="status-dot is-ok"></span>
          <span>${escapeHtml(sname)}</span>
        </span>
        <span class="source-count">${countsInView.get(sid) || 0} 条</span>
      </li>
    `);
    els.sourceRadarList.innerHTML = fallbackRows.join('') || '<li class="source-count">暂无信源数据</li>';
    return;
  }

  els.sourceRadarList.innerHTML = statuses
    .map((st) => {
      const dotClass = st.status === 'ok' ? 'is-ok' : 'is-fail';
      const rightText = st.status === 'ok' ? `${st.count} 条` : (st.error || '离线');
      return `
        <li
          class="source-row ${currentSelect === st.id ? 'is-selected' : ''}"
          data-source-id="${escapeHtml(st.id)}"
          title="${escapeHtml(st.homeUrl || '')}"
        >
          <span class="source-row-left">
            <span class="status-dot ${dotClass}"></span>
            <span>${escapeHtml(st.name)}</span>
          </span>
          <span class="source-count">${escapeHtml(rightText)}</span>
        </li>
      `;
    })
    .join('');
}

function renderHotKeywords() {
  if (!state.hotKeywords.length) {
    els.hotChips.innerHTML = '<span class="hot-label">暂无高频词</span>';
    return;
  }

  els.hotChips.innerHTML = state.hotKeywords
    .map((kw) => {
      const isActive = state.filters.keyword === kw.word;
      return `
        <button
          type="button"
          class="hot-chip ${isActive ? 'is-active' : ''}"
          data-hot-word="${escapeHtml(kw.word)}"
        >
          ${escapeHtml(kw.word)} · ${kw.count}
        </button>
      `;
    })
    .join('');
}

function getFilteredArticles() {
  const { category, lang, source, search, keyword } = state.filters;
  const searchLower = search.trim().toLowerCase();
  const kwLower = keyword.trim().toLowerCase();

  return state.articles.filter((art) => {
    if (category !== 'all' && art.category !== category) return false;
    if (lang !== 'all' && art.lang !== lang) return false;
    if (source !== 'all' && art.sourceId !== source && art.sourceName !== source) return false;

    const fullText = `${art.title} ${art.summary} ${art.sourceName}`.toLowerCase();
    if (kwLower && !fullText.includes(kwLower)) return false;
    if (searchLower && !fullText.includes(searchLower)) return false;
    return true;
  });
}

function renderNewsList() {
  const filtered = getFilteredArticles();
  const isAllMode = state.selectedDate === 'all';
  els.feedHeading.textContent = isAllMode
    ? '跨日 AI 情报总库'
    : `${formatDayChipLabel(state.selectedDate)} · AI 情报流`;
  els.feedSubheading.textContent = `当前显示 ${filtered.length} / ${state.articles.length} 条 · 按发布时间倒序`;

  if (filtered.length === 0) {
    els.newsList.innerHTML = `
      <div class="empty-state">
        <p>该筛选条件下暂无 AI 新闻。</p>
        <p>你可以切换日期、放宽筛选条件，或点击右上角「立即采集今日」与「+ 录入情报」。</p>
      </div>
    `;
    return;
  }

  els.newsList.innerHTML = filtered
    .map((art) => {
      const collected = isArticleCollected(art);
      const catLabel = CATEGORY_LABELS[art.category] || 'AI 资讯';
      const timeText = formatArticleTime(art.publishedAt, isAllMode);
      const link = safeHref(art.url);
      return `
        <article class="news-card ${collected ? 'is-collected' : ''}" data-article-id="${escapeHtml(art.id)}">
          <div class="news-card-meta">
            <div class="news-meta-left">
              <span class="source-badge">${escapeHtml(art.sourceName)}</span>
              <span class="time-label">${escapeHtml(timeText)}</span>
            </div>
            <span class="category-badge">${escapeHtml(catLabel)}</span>
          </div>
          <h3 class="news-title">
            <a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(art.title)}</a>
          </h3>
          <p class="news-summary">${escapeHtml(art.summary)}</p>
          <div class="news-card-actions">
            <button
              type="button"
              class="collect-btn ${collected ? 'is-collected' : ''}"
              data-toggle-collect="${escapeHtml(art.id)}"
            >
              ${collected ? '✓ 已收入当日简报' : '+ 收入简报'}
            </button>
            <div class="card-link-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-copy-url="${escapeHtml(link)}">
                复制链接
              </button>
              <a class="btn btn-ghost btn-sm" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">
                阅读原文 ↗
              </a>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderCuratedPanel() {
  const activeDate = getActiveCuratedDate();
  const items = state.curated.items || [];
  els.briefPanelTitle.textContent = `${activeDate.slice(5)} 精选简报册`;
  els.briefPanelMeta.textContent = `${items.length} 条已收入 · 自动保存至本机`;
  els.mobileBriefCount.textContent = String(items.length);

  if (els.dailySummaryInput.value !== (state.curated.dailySummary || '')) {
    els.dailySummaryInput.value = state.curated.dailySummary || '';
  }

  if (items.length === 0) {
    els.curatedList.innerHTML = `
      <div class="curated-empty">
        点击左侧新闻卡片的「+ 收入简报」，即可收集整理 ${escapeHtml(activeDate)} 的 AI 日报。
      </div>
    `;
    return;
  }

  els.curatedList.innerHTML = items
    .map((item, idx) => `
      <div class="curated-item" data-curated-idx="${idx}">
        <div class="curated-item-head">
          <a
            class="curated-item-title"
            href="${escapeHtml(safeHref(item.url))}"
            target="_blank"
            rel="noopener noreferrer"
          >${idx + 1}. ${escapeHtml(item.title)}</a>
          <div class="curated-item-controls">
            <button type="button" class="mini-btn" data-move-up="${idx}" ${idx === 0 ? 'disabled' : ''} title="上移">↑</button>
            <button type="button" class="mini-btn" data-move-down="${idx}" ${idx === items.length - 1 ? 'disabled' : ''} title="下移">↓</button>
            <button type="button" class="mini-btn text-danger" data-remove-curated="${idx}" title="移除">✕</button>
          </div>
        </div>
        <div class="curated-item-meta">
          ${escapeHtml(item.sourceName || '未知来源')} · ${escapeHtml(CATEGORY_LABELS[item.category] || 'AI')}
        </div>
        <input
          type="text"
          class="curated-note-input"
          data-note-idx="${idx}"
          value="${escapeHtml(item.note || '')}"
          placeholder="写一句个人点评或核心结论…"
        />
      </div>
    `)
    .join('');
}

/* ---------- 简报生成逻辑 ---------- */
function buildDailyBriefText(format = 'markdown') {
  const dateKey = getActiveCuratedDate();
  const useFallback = els.exportIncludeAllFallback.checked;
  let list = state.curated.items || [];
  if (list.length === 0 && useFallback) {
    list = state.articles.slice(0, 8);
  }

  const dailySummary = (state.curated.dailySummary || '').trim();

  if (format === 'plain') {
    const lines = [`【每日 AI 情报早报 · ${dateKey}】`, ''];
    if (dailySummary) {
      lines.push(`今日观察：${dailySummary}`, '');
    }
    if (list.length === 0) {
      lines.push('暂无已收集的新闻条目。');
      return lines.join('\n');
    }
    list.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.title}（${item.sourceName}）`);
      if (item.summary) lines.push(`   摘要：${item.summary}`);
      if (item.note) lines.push(`   点评：${item.note}`);
      if (item.url) lines.push(`   原文：${item.url}`);
      lines.push('');
    });
    return lines.join('\n').trim();
  }

  const md = [`# 每日 AI 情报简报（${dateKey}）`, ''];
  if (dailySummary) {
    md.push(`> **今日核心观察**：${dailySummary}`, '');
  }
  md.push(`共收录 **${list.length}** 条重点资讯。`, '');

  if (list.length === 0) {
    md.push('*本日暂未收入精选条目，可勾选上方“自动用当天高热资讯填充”或返回主列表勾选新闻。*');
    return md.join('\n');
  }

  list.forEach((item, idx) => {
    const cat = CATEGORY_LABELS[item.category] || 'AI 资讯';
    md.push(`## ${idx + 1}. ${item.title}`);
    md.push(`- **来源**：${item.sourceName} · **领域**：${cat}`);
    if (item.summary) md.push(`- **核心摘要**：${item.summary}`);
    if (item.note) md.push(`- **观察批注**：${item.note}`);
    if (item.url) md.push(`- **原文链接**：[${item.url}](${item.url})`);
    md.push('');
  });

  return md.join('\n').trim();
}

function refreshExportPreview() {
  const dateKey = getActiveCuratedDate();
  els.exportModalSubtitle.textContent = `当前导出日期：${dateKey} · 支持一键复制或下载 Markdown`;
  els.exportPreviewArea.value = buildDailyBriefText(state.exportFormat);
}

/* ---------- 录入弹窗与 URL 智能提取 ---------- */
function openManualModal() {
  els.manualForm.reset();
  els.manualDateInput.value = getActiveCuratedDate();
  els.manualAddCuratedCheck.checked = true;
  els.extractStatusHint.textContent = '';
  els.manualModal.showModal();
}

async function handleExtractUrl() {
  const url = els.manualUrlInput.value.trim();
  if (!url) {
    els.extractStatusHint.textContent = '请先输入文章链接 URL';
    return;
  }
  els.extractUrlBtn.disabled = true;
  els.extractUrlBtn.textContent = '提取中…';
  els.extractStatusHint.textContent = '正在读取网页标题与描述信息…';

  try {
    if (state.mode !== 'server') {
      const parsed = new URL(url);
      els.manualSourceInput.value = parsed.hostname.replace(/^www\./, '');
      els.extractStatusHint.textContent = '静态模式下仅提取域名，请手动补充标题与摘要。';
      return;
    }

    const res = await apiFetchJson('./api/extract-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (res.title && !els.manualTitleInput.value) els.manualTitleInput.value = res.title;
    if (res.summary && !els.manualSummaryInput.value) els.manualSummaryInput.value = res.summary;
    if (res.sourceName && !els.manualSourceInput.value) els.manualSourceInput.value = res.sourceName;
    if (res.category) els.manualCategorySelect.value = res.category;

    els.extractStatusHint.textContent = res.ok
      ? '提取成功，可核对修改后点击保存。'
      : (res.warning || '已填入站点名称，请手动补充标题。');
  } catch (err) {
    els.extractStatusHint.textContent = `提取失败：${err.message}`;
  } finally {
    els.extractUrlBtn.disabled = false;
    els.extractUrlBtn.textContent = '智能提取';
  }
}

async function handleManualSubmit(event) {
  event.preventDefault();
  const payload = {
    date: els.manualDateInput.value || getActiveCuratedDate(),
    url: els.manualUrlInput.value.trim(),
    title: els.manualTitleInput.value.trim(),
    sourceName: els.manualSourceInput.value.trim() || '手动录入',
    category: els.manualCategorySelect.value,
    summary: els.manualSummaryInput.value.trim(),
    note: els.manualNoteInput.value.trim(),
    addToCurated: els.manualAddCuratedCheck.checked
  };

  if (!payload.title) {
    showToast('请填写新闻标题');
    return;
  }

  try {
    if (state.mode !== 'server') {
      const store = readLocalBrowserStore(state.mode === 'offline');
      const art = {
        id: `manual_${Date.now()}`,
        date: payload.date,
        publishedAt: new Date().toISOString(),
        title: payload.title,
        summary: payload.summary || '手动收录情报。',
        url: payload.url,
        sourceId: 'manual',
        sourceName: payload.sourceName,
        category: payload.category,
        lang: /[\u4e00-\u9fa5]/.test(payload.title) ? 'zh' : 'en'
      };
      if (!store.articlesByDate[payload.date]) store.articlesByDate[payload.date] = [];
      store.articlesByDate[payload.date].unshift(art);
      if (payload.addToCurated) {
        if (!store.curatedByDate[payload.date]) store.curatedByDate[payload.date] = { dailySummary: '', items: [] };
        store.curatedByDate[payload.date].items.unshift({ ...art, note: payload.note, savedAt: new Date().toISOString() });
      }
      writeLocalBrowserStore(store);
      els.manualModal.close();
      state.selectedDate = payload.date;
      if (state.mode === 'pages' && state.pagesBaseOverview) {
        await activatePagesMode(state.pagesBaseOverview);
      } else {
        activateOfflineMode();
      }
      showToast('已保存新情报');
      return;
    }

    const res = await apiFetchJson('./api/day/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    els.manualModal.close();
    applyOverview(res.overview);
    await loadDay(payload.date);
    showToast('已录入每日情报库');
  } catch (err) {
    showToast(`录入失败：${err.message}`);
  }
}

/* ---------- 事件绑定 ---------- */
function bindEvents() {
  els.themeToggleBtn.addEventListener('click', toggleTheme);
  els.syncNowBtn.addEventListener('click', triggerSyncNow);
  els.openManualModalBtn.addEventListener('click', openManualModal);
  els.extractUrlBtn.addEventListener('click', handleExtractUrl);
  els.manualForm.addEventListener('submit', handleManualSubmit);

  // 时间轴日期切换
  els.timelineChips.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-date-chip]');
    if (!btn) return;
    loadDay(btn.dataset.dateChip);
  });

  els.datePickerInput.addEventListener('change', (e) => {
    if (e.target.value) loadDay(e.target.value);
  });

  els.allDaysToggleBtn.addEventListener('click', () => {
    const next = state.selectedDate === 'all' ? state.today : 'all';
    loadDay(next);
  });

  // 分类、语言、信源与搜索过滤
  els.categoryTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-category]');
    if (!tab) return;
    state.filters.category = tab.dataset.category;
    els.categoryTabs.querySelectorAll('.cat-tab').forEach((node) => {
      node.classList.toggle('is-active', node === tab);
    });
    renderNewsList();
  });

  els.langFilterSelect.addEventListener('change', (e) => {
    state.filters.lang = e.target.value;
    renderNewsList();
  });

  els.sourceFilterSelect.addEventListener('change', (e) => {
    state.filters.source = e.target.value;
    renderSourceSelectAndRadar();
    renderNewsList();
  });

  els.searchInput.addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    renderNewsList();
  });

  els.hotChips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-hot-word]');
    if (!chip) return;
    const word = chip.dataset.hotWord;
    state.filters.keyword = state.filters.keyword === word ? '' : word;
    renderHotKeywords();
    renderNewsList();
  });

  // 快捷键 `/` 聚焦搜索框
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault();
      els.searchInput.focus();
    }
  });

  // 左侧新闻流按钮事件代理
  els.newsList.addEventListener('click', async (e) => {
    const toggleBtn = e.target.closest('[data-toggle-collect]');
    if (toggleBtn) {
      const id = toggleBtn.dataset.toggleCollect;
      const article = state.articles.find((a) => a.id === id);
      if (article) toggleCollectArticle(article);
      return;
    }

    const copyBtn = e.target.closest('[data-copy-url]');
    if (copyBtn) {
      const url = copyBtn.dataset.copyUrl;
      try {
        await navigator.clipboard.writeText(url);
        showToast('原文链接已复制到剪贴板');
      } catch {
        showToast('复制失败，请手动右键复制链接');
      }
    }
  });

  // 右侧信源雷达点击过滤
  els.sourceRadarList.addEventListener('click', (e) => {
    const row = e.target.closest('[data-source-id]');
    if (!row) return;
    const sid = row.dataset.sourceId;
    state.filters.source = state.filters.source === sid ? 'all' : sid;
    renderSourceSelectAndRadar();
    renderNewsList();
  });

  // 当日观察导语自动防抖保存
  els.dailySummaryInput.addEventListener('input', (e) => {
    state.curated.dailySummary = e.target.value;
    clearTimeout(state.summarySaveTimer);
    state.summarySaveTimer = setTimeout(() => {
      persistCurated();
    }, 500);
  });

  // 精选列表控制与批注编辑
  els.curatedList.addEventListener('click', (e) => {
    const up = e.target.closest('[data-move-up]');
    if (up) return moveCuratedItem(Number(up.dataset.moveUp), -1);

    const down = e.target.closest('[data-move-down]');
    if (down) return moveCuratedItem(Number(down.dataset.moveDown), 1);

    const rem = e.target.closest('[data-remove-curated]');
    if (rem) return removeCuratedItem(Number(rem.dataset.removeCurated));
  });

  els.curatedList.addEventListener('input', (e) => {
    const noteInput = e.target.closest('[data-note-idx]');
    if (!noteInput) return;
    const idx = Number(noteInput.dataset.noteIdx);
    if (state.curated.items[idx]) {
      state.curated.items[idx].note = noteInput.value;
      clearTimeout(state.summarySaveTimer);
      state.summarySaveTimer = setTimeout(() => {
        persistCurated();
      }, 450);
    }
  });

  els.clearDayBriefBtn.addEventListener('click', () => {
    if (!(state.curated.items?.length || state.curated.dailySummary)) return;
    state.curated = { dailySummary: '', items: [] };
    renderNewsList();
    renderCuratedPanel();
    persistCurated();
    showToast('已清空本日简报草稿');
  });

  els.downloadArchiveBtn.addEventListener('click', () => {
    if (state.mode === 'server') {
      window.location.href = './api/export-archive';
      return;
    }
    if (state.mode === 'pages') {
      const a = document.createElement('a');
      a.href = './api-static/archive.json';
      a.download = `ai-news-archive-${state.today}.json`;
      a.click();
      return;
    }
    const blob = new Blob([JSON.stringify(readLocalBrowserStore(true), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-news-archive-${state.today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // 导出简报弹窗
  els.openExportModalBtn.addEventListener('click', () => {
    refreshExportPreview();
    els.exportModal.showModal();
  });

  document.querySelectorAll('[data-export-format]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.exportFormat = btn.dataset.exportFormat;
      document.querySelectorAll('[data-export-format]').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      refreshExportPreview();
    });
  });

  els.exportIncludeAllFallback.addEventListener('change', refreshExportPreview);

  els.copyExportBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(els.exportPreviewArea.value);
      showToast('已复制完整简报内容');
    } catch {
      els.exportPreviewArea.select();
      document.execCommand('copy');
      showToast('已选中并复制内容');
    }
  });

  els.downloadMdBtn.addEventListener('click', () => {
    const content = buildDailyBriefText('markdown');
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI日报-${getActiveCuratedDate()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Markdown 日报文件已导出');
  });

  // 弹窗通用关闭
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.closeModal;
      document.getElementById(targetId)?.close();
    });
  });

  [els.manualModal, els.exportModal].forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close();
    });
  });

  // 移动端简报抽屉开关
  els.mobileOpenBriefBtn.addEventListener('click', () => {
    els.briefSidebar.classList.add('is-mobile-open');
  });
  els.mobileCloseBriefBtn.addEventListener('click', () => {
    els.briefSidebar.classList.remove('is-mobile-open');
  });
}

initTheme();
bindEvents();
loadInitialData();
