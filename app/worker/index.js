import { runResearch } from "../server/research.js";

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {}),
    },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "competitor-radar-worker", now: new Date().toISOString() });
    }

    if (url.pathname === "/api/config") {
      return json({
        provider: "deepseek",
        model: env.DEEPSEEK_MODEL || "deepseek-chat",
        hasDeepSeekKey: Boolean(env.DEEPSEEK_API_KEY),
      });
    }

    if (url.pathname === "/api/research" && request.method === "POST") {
      const { idea, sources, limit } = await readJson(request);
      if (!idea || typeof idea !== "string" || idea.trim().length < 2) {
        return json({ error: "请输入至少 2 个字符的产品想法。" }, { status: 400 });
      }

      try {
        const payload = await runResearch({
          idea,
          sources,
          limit: Number(limit || 42),
          deepseekApiKey: env.DEEPSEEK_API_KEY || "",
          deepseekModel: env.DEEPSEEK_MODEL || "deepseek-chat",
        });
        return json(payload);
      } catch (error) {
        return json(
          {
            error: "调研任务失败",
            detail: error instanceof Error ? error.message : String(error),
          },
          { status: 500 },
        );
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};
