import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArchiveStore } from '../lib/archive-store.mjs';
import { fetchLiveSources } from '../lib/sources.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * 执行一次全量信源抓取并将新增文章增量合并到按日归档库。
 */
export async function collectDailyNews({
  archivePath = path.join(ROOT_DIR, 'data', 'archive.json'),
  seedPath = path.join(ROOT_DIR, 'data', 'seed-daily.json'),
  timeoutMs = 10000
} = {}) {
  const store = new ArchiveStore({ archivePath, seedPath, autoSyncIntervalMinutes: 30 });
  await store.init();

  const live = await fetchLiveSources({ timeoutMs });
  const merged = await store.mergeArticles(live.articles, {
    fetchedAt: live.fetchedAt,
    sourceStatuses: live.sourceStatuses
  });
  const overview = await store.getDaysOverview();

  return {
    fetchedAt: live.fetchedAt,
    onlineSources: live.sourceStatuses.filter((s) => s.status === 'ok').length,
    totalSources: live.sourceStatuses.length,
    fetchedCount: live.articles.length,
    addedCount: merged.addedCount,
    touchedDates: merged.touchedDates,
    totalDays: overview.totalDays,
    totalArticles: overview.totalArticles
  };
}

const isDirectEntry = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectEntry) {
  collectDailyNews()
    .then((summary) => {
      console.log(
        `[collect-daily] 在线信源 ${summary.onlineSources}/${summary.totalSources}，` +
        `抓取 ${summary.fetchedCount} 条，新增入库 ${summary.addedCount} 条，` +
        `累计归档 ${summary.totalDays} 天 / ${summary.totalArticles} 条。`
      );
    })
    .catch((err) => {
      console.error('[collect-daily] 采集失败:', err);
      process.exitCode = 1;
    });
}
