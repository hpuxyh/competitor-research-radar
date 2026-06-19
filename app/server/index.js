import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runResearch } from "./research.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 8787);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "competitor-radar", now: new Date().toISOString() });
});

app.get("/api/config", (_req, res) => {
  res.json({
    provider: "deepseek",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    hasDeepSeekKey: Boolean(process.env.DEEPSEEK_API_KEY),
  });
});

app.post("/api/research", async (req, res) => {
  try {
    const { idea, sources, limit } = req.body ?? {};
    if (!idea || typeof idea !== "string" || idea.trim().length < 2) {
      res.status(400).json({ error: "请输入至少 2 个字符的产品想法。" });
      return;
    }

    const payload = await runResearch({
      idea,
      sources,
      limit: Number(limit || 36),
      deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
      deepseekModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    });

    res.json(payload);
  } catch (error) {
    res.status(500).json({
      error: "调研任务失败",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

const distDir = path.resolve(__dirname, "../dist");
app.use(express.static(distDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"), (error) => {
    if (error) {
      res.status(404).send("Run npm run build first, or use npm run dev for the Vite workspace.");
    }
  });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Competitor Radar API listening on http://127.0.0.1:${port}`);
});
