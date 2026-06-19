# 竞品雷达

一个可本地运行、也可部署到 Cloudflare Worker 的竞品调研工作台：输入一个模糊产品想法后，自动搜索网站和 App 线索，整理相似之处、目标人群、产品分类和体验链接。

## 能做什么

- 从公开 Web 搜索、iOS App Store 和 Google Play 搜索入口拉取候选竞品。
- 根据产品名称、简介、链接文本和输入想法生成相似度解释。
- 自动推断分类和目标人群，并保留“公开事实”和“PM 推断”的边界。
- 提供直接跳转链接，方便继续体验 App 或网站。
- 支持筛选、排序和导出 Markdown 报告。
- 支持 Cloudflare Worker 后端调用 DeepSeek API；未配置 Key 时自动使用本地规则兜底。
- 支持项目保存、历史恢复、对比矩阵和洞察报告视图。

## 运行

```bash
npm install
npm run dev
```

打开 Vite 输出的本地地址，默认是：

```text
http://127.0.0.1:5178
```

## 线上部署

```bash
npm run deploy
```

当前 Worker 使用 Cloudflare Workers Static Assets 托管前端，并在同一个 Worker 中提供 `/api/research`。

## DeepSeek API Key

不要把 Key 写入 GitHub。线上通过 Wrangler secret 配置：

```bash
npx wrangler secret put DEEPSEEK_API_KEY
```

本地调试可复制 `.dev.vars.example` 为 `.dev.vars`，填入：

```text
DEEPSEEK_API_KEY=sk-your-deepseek-key
```

默认模型是 `deepseek-chat`，可在 `wrangler.jsonc` 的 `DEEPSEEK_MODEL` 中调整。

## 单独测试搜索 API

```bash
npm run research:sample
```

也可以直接调用：

```bash
curl -X POST http://127.0.0.1:8787/api/research \
  -H 'content-type: application/json' \
  -d '{"idea":"AI 搜索和个人知识库结合的生产力工具","sources":["web","ios","googlePlay"]}'
```

## 设计概念

概念图保存在：

```text
docs/concept-competitor-radar.png
```

## 说明

当前版本走“公开搜索 + DeepSeek 分析 + 规则兜底”的路线。DeepSeek 未配置时仍可执行基础搜索和分类；配置 Key 后会自动补充更细的相似点、机会点、风险点和验证问题。
