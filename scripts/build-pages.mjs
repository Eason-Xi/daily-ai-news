import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArchiveStore } from '../lib/archive-store.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * 构建用于 GitHub Pages 的纯静态站点与静态化每日 JSON 快照接口。
 */
export async function buildPagesSite({
  archiveStore,
  archivePath = path.join(ROOT_DIR, 'data', 'archive.json'),
  seedPath = path.join(ROOT_DIR, 'data', 'seed-daily.json'),
  publicDir = path.join(ROOT_DIR, 'public'),
  outDir = path.join(ROOT_DIR, '_site')
} = {}) {
  const store = archiveStore || new ArchiveStore({ archivePath, seedPath, autoSyncIntervalMinutes: 30 });
  await store.init();

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(publicDir, outDir, { recursive: true });
  await writeFile(path.join(outDir, '.nojekyll'), '', 'utf8');

  const apiStaticDir = path.join(outDir, 'api-static');
  const daysDir = path.join(apiStaticDir, 'days');
  await mkdir(daysDir, { recursive: true });

  const overview = await store.getDaysOverview();
  await writeFile(path.join(apiStaticDir, 'days.json'), JSON.stringify(overview), 'utf8');

  for (const day of overview.days) {
    const detail = await store.getDayDetail(day.date);
    await writeFile(path.join(daysDir, `${day.date}.json`), JSON.stringify(detail), 'utf8');
  }

  const allDetail = await store.getDayDetail('all');
  const trimmedAll = {
    ...allDetail,
    articles: allDetail.articles.slice(0, 300)
  };
  await writeFile(path.join(apiStaticDir, 'all.json'), JSON.stringify(trimmedAll), 'utf8');

  const archiveDump = await store.exportFullArchive();
  await writeFile(path.join(apiStaticDir, 'archive.json'), JSON.stringify(archiveDump, null, 2), 'utf8');

  return {
    outDir,
    daysCount: overview.days.length,
    totalArticles: overview.totalArticles
  };
}

const isDirectEntry = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectEntry) {
  buildPagesSite()
    .then((res) => {
      console.log(
        `[build-pages] 静态站点构建完成 -> ${res.outDir}（${res.daysCount} 个日期文件，共 ${res.totalArticles} 条新闻）`
      );
    })
    .catch((err) => {
      console.error('[build-pages] 构建失败:', err);
      process.exitCode = 1;
    });
}
