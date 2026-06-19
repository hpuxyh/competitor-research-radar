# 竞品雷达

一个用于竞品调研的可执行 Web 工具：输入产品想法后，搜索网站、iOS App 和 Google Play 相关产品，输出相似点、目标人群、分类、体验链接、对比表和报告。

- 线上可用版：<https://competitor-research-radar.hpuxyh-taste-lens.workers.dev/>
- GitHub Pages 跳转入口：<https://hpuxyh.github.io/competitor-research-radar/>
- 完整源码：[`app/`](./app)

## DeepSeek

线上版默认使用 DeepSeek 作为模型提供方，API Key 通过 Cloudflare Worker Secret 注入，不会提交到 GitHub。未配置 Secret 时，应用会自动使用本地规则分析兜底。

```bash
cd app
npx wrangler secret put DEEPSEEK_API_KEY
npm run deploy
```
