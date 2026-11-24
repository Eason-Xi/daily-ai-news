import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildArticleId,
  classifyArticle,
  dedupeArticles,
  extractHotKeywords,
  isDeepArticleUrl,
  normalizeUrl,
  toDateKey
} from './rss-parser.mjs';

export class ArchiveStore {
  constructor({ archivePath, seedPath, autoSyncIntervalMinutes = 30 }) {
    this.archivePath = archivePath;
    this.seedPath = seedPath;
    this.autoSyncIntervalMinutes = autoSyncIntervalMinutes;
    this.data = null;
    this.writeQueue = Promise.resolve();
  }

  async init() {
    if (this.data) return this.data;

    try {
      const raw = await readFile(this.archivePath, 'utf8');
      const parsed = JSON.parse(raw);
      this.data = {
        version: 1,
        meta: {
          lastSyncAt: parsed.meta?.lastSyncAt || null,
          autoSyncIntervalMinutes: this.autoSyncIntervalMinutes,
          sourceStatuses: Array.isArray(parsed.meta?.sourceStatuses) ? parsed.meta.sourceStatuses : []
        },
        articlesByDate: parsed.articlesByDate && typeof parsed.articlesByDate === 'object' ? parsed.articlesByDate : {},
        curatedByDate: parsed.curatedByDate && typeof parsed.curatedByDate === 'object' ? parsed.curatedByDate : {}
      };
      const cleaned = this.#pruneInvalidSeedAndShallowUrls();
      if (cleaned) {
        await this.#persist();
      }
    } catch {
      const initialArticles = await this.#loadSeedArticles();
      const articlesByDate = {};
      for (const article of initialArticles) {
        const key = article.date || toDateKey(article.publishedAt);
        if (!articlesByDate[key]) articlesByDate[key] = [];
        articlesByDate[key].push(article);
      }
      for (const key of Object.keys(articlesByDate)) {
        articlesByDate[key] = dedupeArticles(articlesByDate[key], []);
      }
      this.data = {
        version: 1,
        meta: {
          lastSyncAt: null,
          autoSyncIntervalMinutes: this.autoSyncIntervalMinutes,
          sourceStatuses: []
        },
        articlesByDate,
        curatedByDate: {}
      };
      await this.#persist();
    }

    return this.data;
  }

  #pruneInvalidSeedAndShallowUrls() {
    let changed = false;
    for (const dateKey of Object.keys(this.data.articlesByDate)) {
      const prev = Array.isArray(this.data.articlesByDate[dateKey]) ? this.data.articlesByDate[dateKey] : [];
      const filtered = prev.filter((item) => {
        if (!item) return false;
        if (item.sourceId === 'seed-global' || item.sourceId === 'seed-cn') return false;
        if (item.sourceId === 'manual') return true;
        return isDeepArticleUrl(item.url);
      });
      if (filtered.length !== prev.length) {
        changed = true;
        if (filtered.length > 0) {
          this.data.articlesByDate[dateKey] = filtered;
        } else {
          delete this.data.articlesByDate[dateKey];
        }
      }
    }
    return changed;
  }

  async #loadSeedArticles() {
    if (!this.seedPath) return [];
    try {
      const raw = await readFile(this.seedPath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.articles) ? parsed.articles : [];
    } catch {
      return [];
    }
  }

  async #persist() {
    const dir = path.dirname(this.archivePath);
    const snapshot = JSON.stringify(this.data, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(dir, { recursive: true });
      const tmpPath = `${this.archivePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tmpPath, snapshot, 'utf8');
      await rename(tmpPath, this.archivePath);
    });
    return this.writeQueue;
  }

  async mergeArticles(incomingArticles = [], syncMeta = {}) {
    await this.init();
    const touchedDates = new Set();
    const bucketed = new Map();

    for (const item of incomingArticles) {
      if (!item || !item.title) continue;
      const dateKey = item.date || toDateKey(item.publishedAt);
      if (!bucketed.has(dateKey)) bucketed.set(dateKey, []);
      bucketed.get(dateKey).push({ ...item, date: dateKey });
    }

    let addedCount = 0;
    for (const [dateKey, list] of bucketed.entries()) {
      const prev = this.data.articlesByDate[dateKey] || [];
      const merged = dedupeArticles(prev, list);
      if (merged.length > prev.length) {
        addedCount += merged.length - prev.length;
      }
      this.data.articlesByDate[dateKey] = merged;
      touchedDates.add(dateKey);
    }

    if (syncMeta.fetchedAt) {
      this.data.meta.lastSyncAt = syncMeta.fetchedAt;
    }
    if (Array.isArray(syncMeta.sourceStatuses)) {
      this.data.meta.sourceStatuses = syncMeta.sourceStatuses;
    }

    await this.#persist();
    return {
      addedCount,
      touchedDates: [...touchedDates].sort().reverse()
    };
  }

  async getDaysOverview() {
    await this.init();
    const todayKey = toDateKey(new Date());
    const dateSet = new Set([
      todayKey,
      ...Object.keys(this.data.articlesByDate),
      ...Object.keys(this.data.curatedByDate)
    ]);

    const days = [...dateSet]
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort((a, b) => b.localeCompare(a))
      .map((date) => {
        const list = this.data.articlesByDate[date] || [];
        const curated = this.data.curatedByDate[date];
        const curatedCount = Array.isArray(curated?.items) ? curated.items.length : 0;
        return {
          date,
          count: list.length,
          curatedCount,
          hasSummary: Boolean(curated?.dailySummary?.trim()),
          previewTitles: list.slice(0, 2).map((a) => a.title)
        };
      });

    const totalArticles = days.reduce((sum, d) => sum + d.count, 0);
    const totalCurated = days.reduce((sum, d) => sum + d.curatedCount, 0);

    return {
      today: todayKey,
      days,
      totalDays: days.filter((d) => d.count > 0 || d.curatedCount > 0).length,
      totalArticles,
      totalCurated,
      meta: this.data.meta
    };
  }

  async getDayDetail(dateOrAll) {
    await this.init();
    const target = dateOrAll || toDateKey(new Date());

    if (target === 'all') {
      const allArticles = Object.values(this.data.articlesByDate).flat();
      const sorted = dedupeArticles(allArticles, []);
      const todayKey = toDateKey(new Date());
      const todayCurated = this.data.curatedByDate[todayKey] || { dailySummary: '', items: [] };
      return {
        date: 'all',
        articles: sorted,
        hotKeywords: extractHotKeywords(sorted, 10),
        curated: todayCurated
      };
    }

    const articles = dedupeArticles(this.data.articlesByDate[target] || [], []);
    const curated = this.data.curatedByDate[target] || { dailySummary: '', items: [] };

    return {
      date: target,
      articles,
      hotKeywords: extractHotKeywords(articles, 8),
      curated: {
        dailySummary: curated.dailySummary || '',
        items: Array.isArray(curated.items) ? curated.items : []
      }
    };
  }

  async updateDayCurated(date, payload = {}) {
    await this.init();
    const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))
      ? date
      : toDateKey(new Date());

    const existing = this.data.curatedByDate[targetDate] || { dailySummary: '', items: [] };
    const nextSummary = typeof payload.dailySummary === 'string'
      ? payload.dailySummary.slice(0, 800)
      : (existing.dailySummary || '');

    let nextItems = existing.items || [];
    if (Array.isArray(payload.items)) {
      nextItems = payload.items
        .filter((item) => item && item.title)
        .map((item) => ({
          id: item.id || buildArticleId(item.url, item.sourceId || 'curated', item.title),
          date: item.date || targetDate,
          title: String(item.title).trim().slice(0, 220),
          url: normalizeUrl(item.url || '') || '',
          sourceName: String(item.sourceName || '人工精选').trim().slice(0, 60),
          category: item.category || classifyArticle(item.title, item.summary || ''),
          summary: String(item.summary || '').trim().slice(0, 400),
          publishedAt: item.publishedAt || new Date().toISOString(),
          note: String(item.note || '').trim().slice(0, 400),
          savedAt: item.savedAt || new Date().toISOString()
        }));
    }

    this.data.curatedByDate[targetDate] = {
      dailySummary: nextSummary,
      items: nextItems,
      updatedAt: new Date().toISOString()
    };

    await this.#persist();
    return this.data.curatedByDate[targetDate];
  }

  async addManualArticle(date, articleInput = {}, addToCurated = true) {
    await this.init();
    const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))
      ? date
      : toDateKey(new Date());

    const title = String(articleInput.title || '').trim();
    if (!title) {
      throw new Error('新闻标题不能为空');
    }

    const url = normalizeUrl(articleInput.url || '');
    const summary = String(articleInput.summary || '').trim() || '手动收集收录的 AI 行业动态。';
    const sourceName = String(articleInput.sourceName || '手动录入').trim();
    const category = articleInput.category || classifyArticle(title, summary, 'model');
    const nowIso = new Date().toISOString();
    const publishedAt = articleInput.publishedAt ||
      (targetDate === toDateKey(new Date()) ? nowIso : `${targetDate}T12:00:00+08:00`);

    const article = {
      id: buildArticleId(url, 'manual', title),
      date: targetDate,
      publishedAt,
      title,
      summary,
      url,
      sourceId: 'manual',
      sourceName,
      category,
      lang: /[\u4e00-\u9fa5]/.test(title) ? 'zh' : 'en'
    };

    const existingList = this.data.articlesByDate[targetDate] || [];
    this.data.articlesByDate[targetDate] = dedupeArticles([article], existingList);

    if (addToCurated) {
      const existingCurated = this.data.curatedByDate[targetDate] || { dailySummary: '', items: [] };
      const alreadyExists = existingCurated.items.some(
        (c) => c.id === article.id || (url && normalizeUrl(c.url) === url)
      );
      if (!alreadyExists) {
        const nextItems = [
          {
            ...article,
            note: String(articleInput.note || '').trim(),
            savedAt: nowIso
          },
          ...existingCurated.items
        ];
        this.data.curatedByDate[targetDate] = {
          dailySummary: existingCurated.dailySummary || '',
          items: nextItems,
          updatedAt: nowIso
        };
      }
    }

    await this.#persist();
    return {
      article,
      dayDetail: await this.getDayDetail(targetDate)
    };
  }

  async exportFullArchive() {
    await this.init();
    return {
      exportedAt: new Date().toISOString(),
      ...this.data
    };
  }
}
