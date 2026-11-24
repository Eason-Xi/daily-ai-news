# 每日 AI 情报库 · Daily AI Archive

一个零外部 npm 依赖、前后端一体化的「每日 AI 新闻收集与按日归档」网页应用。支持多源实时抓取、自动按天增量去重沉淀、多维度筛选检索、个人点评批注以及一键生成每日 Markdown / 社群快讯简报。

## 核心特性

- **精编 AI 日报 & 周报（接入 AIHOT）**：集成 [AIHOT (aihot.news)](https://aihot.news/) 每日 08:00 发布的精编中文 AI 日报与每周回顾，含头版头条导读、分栏目列表、AI 质量评分与入选理由，支持一键「复制整期 Markdown」或将重点条目收入个人简报册。
- **48h 热点事件榜与深度综述**：实时追踪多信源共同讨论的 Top 10 AI 热点事件，点击任意热点即可展开多段式 AI 事件综述与完整报道演化时间线。
- **按日自动采集与增量归档**：后端与 GitHub Actions 并发采集全球及中文 10 大 AI 信源（Hacker News AI、Hugging Face Daily Papers、arXiv cs.AI、OpenAI News、TechCrunch AI、The Verge AI、WIRED AI、MIT Tech Review AI、量子位、爱范儿 AI 精选），增量去重写入 `data/archive.json`，历史每一天的新闻持久沉淀不丢失。
- **每日时间轴与跨日全局库**：顶部日期芯片与日历选择器随时切换查看每一天的 AI 情报，也可一键进入「跨日全局库」进行跨天关键词搜索。
- **五维智能分类与热点雷达**：自动划分「大模型与前沿」「Agent 与产品」「开源与论文」「产业与资本」「安全与政策」，并实时提取当日高频实体词胶囊。
- **按日独立简报册与智能录入**：每一天都有专属的精选收集箱与当日观察导语；支持粘贴外部文章 URL 一键提取标题摘要入库，或为每条新闻编写点评批注并上下调整顺位。
- **一键成稿导出**：支持直接预览、复制、下载《每日 AI 情报简报》`.md` 文件、微信/飞书社群快讯纯文本，或导出全库历史 JSON 备份。
- **双模/三模自适应运行**：
  - **本地全栈模式**（`npm start`）：完整本地服务 + URL 提取 + 磁盘持久化 + 后台每 30 分钟自动同步；
  - **GitHub Pages 云端归档模式**：内置 [daily-ai-news.yml](.github/workflows/daily-ai-news.yml) 工作流，每天北京时间 `08:00 / 13:00 / 20:00` 自动运行采集脚本增量更新 `data/archive.json` 并发布静态站点到 GitHub Pages（访客批注与自录条目存于浏览器本地）；
  - **离线纯静态模式**：直接打开 `public/index.html` 亦可流畅浏览与直连同步。

## 快速启动

需要 Node.js >= 20（零 `npm install` 步骤，开箱即用）：

```bash
# 启动本地服务（默认 http://127.0.0.1:3456）
npm start

# 手动运行一次全源增量采集并更新 data/archive.json
npm run collect

# 构建 GitHub Pages 静态站点（输出至 _site/）
npm run build:pages

# 运行自动化测试
npm test
```

打开浏览器访问 `http://127.0.0.1:3456` 即可使用。
