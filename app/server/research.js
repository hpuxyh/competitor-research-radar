import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

const SOURCE_LABELS = {
  web: "Web 网站",
  ios: "iOS App Store",
  googlePlay: "Google Play",
};

const CATEGORY_RULES = [
  {
    category: "AI 搜索 / 问答",
    match: ["ai search", "perplexity", "搜索", "问答", "答案", "knowledge", "answer", "copilot", "gpt", "llm"],
    seeds: ["AI search", "knowledge base", "Perplexity", "NotebookLM"],
    audience: ["知识工作者", "研究人员", "学生"],
  },
  {
    category: "生产力 / 协作",
    match: ["notion", "workspace", "协作", "任务", "项目", "文档", "笔记", "todo", "productivity", "workflow"],
    seeds: ["productivity workspace", "team notes", "task manager", "Notion"],
    audience: ["产品经理", "知识工作者", "团队 / 企业"],
  },
  {
    category: "内容创作 / 设计",
    match: ["写作", "创作", "内容", "设计", "image", "video", "editor", "canvas", "短视频", "海报", "生成"],
    seeds: ["AI writing", "content creator", "design tool", "Canva"],
    audience: ["创作者", "运营 / 市场", "设计师"],
  },
  {
    category: "社区 / 内容平台",
    match: ["社区", "社交", "小红书", "即刻", "reddit", "community", "forum", "帖子", "分享"],
    seeds: ["community app", "social content", "Reddit", "Pinterest"],
    audience: ["年轻用户", "兴趣人群", "内容消费者"],
  },
  {
    category: "产品发现 / 榜单",
    match: ["product hunt", "startup", "discover", "榜单", "发现", "新品", "工具库", "directory"],
    seeds: ["Product Hunt", "startup discovery", "tool directory"],
    audience: ["产品人", "创业者", "开发者"],
  },
  {
    category: "电商 / 消费决策",
    match: ["购物", "电商", "价格", "deal", "amazon", "shop", "review", "点评", "消费", "本地生活"],
    seeds: ["shopping deals", "review app", "local life"],
    audience: ["消费者", "品牌商家", "本地生活用户"],
  },
  {
    category: "教育 / 学习",
    match: ["学习", "课程", "教育", "student", "school", "tutor", "study", "语言", "考试"],
    seeds: ["study app", "AI tutor", "course learning"],
    audience: ["学生", "教师", "终身学习者"],
  },
  {
    category: "开发者工具",
    match: ["developer", "api", "github", "code", "devtool", "sdk", "部署", "监控", "database"],
    seeds: ["developer tools", "code assistant", "API client"],
    audience: ["开发者", "技术团队", "创业团队"],
  },
  {
    category: "健康 / 生活方式",
    match: ["健康", "运动", "睡眠", "饮食", "fitness", "health", "mindfulness", "习惯"],
    seeds: ["health tracker", "fitness app", "habit tracker"],
    audience: ["个人用户", "健康管理人群", "生活方式用户"],
  },
  {
    category: "工具 / 垂直服务",
    match: ["tool", "工具", "service", "平台", "solution", "app", "软件"],
    seeds: ["utility app", "workflow tool", "SaaS tool"],
    audience: ["通用用户", "中小团队", "垂直行业用户"],
  },
];

const RESEARCH_LEAD_PATTERNS = [
  "竞品分析",
  "分析报告",
  "排行榜",
  "排行",
  "工具集",
  "工具目录",
  "导航",
  "推荐",
  "指南",
  "对比",
  "best",
  "top ",
  "list",
  "directory",
  "github.com",
  "知乎",
  "博客",
  "人人都是产品经理",
];

const STOP_WORDS = new Set([
  "一个",
  "一种",
  "可以",
  "能够",
  "帮助",
  "用户",
  "产品",
  "工具",
  "网站",
  "应用",
  "app",
  "web",
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
]);

function cleanText(value = "") {
  return String(value)
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .trim();
}

function getDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeDuckUrl(href) {
  if (!href) return "";
  try {
    const asUrl = href.startsWith("http") ? new URL(href) : new URL(href, "https://duckduckgo.com");
    const encoded = asUrl.searchParams.get("uddg");
    if (encoded) return decodeURIComponent(encoded);
    return asUrl.href;
  } catch {
    return href;
  }
}

function normalizeBingUrl(href) {
  if (!href) return "";
  try {
    const asUrl = href.startsWith("http") ? new URL(href) : new URL(href, "https://www.bing.com");
    const encoded = asUrl.searchParams.get("u");
    if (encoded) {
      let payload = encoded.startsWith("a1") ? encoded.slice(2) : encoded;
      payload = payload.replace(/-/g, "+").replace(/_/g, "/");
      while (payload.length % 4) payload += "=";
      const decoded = Buffer.from(payload, "base64").toString("utf8");
      if (decoded.startsWith("http")) return decoded;
    }
    return asUrl.href;
  } catch {
    return href;
  }
}

function tokenize(text) {
  const normalized = text.toLowerCase();
  const english = normalized.match(/[a-z0-9][a-z0-9+.-]{1,}/g) ?? [];
  const chineseChunks = normalized.match(/[\u4e00-\u9fa5]{2,}/g) ?? [];
  const dictionaryHits = CATEGORY_RULES.flatMap((rule) => rule.match).filter((term) =>
    normalized.includes(term.toLowerCase()),
  );

  return [...new Set([...english, ...chineseChunks, ...dictionaryHits])]
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !STOP_WORDS.has(item));
}

function buildIdeaProfile(idea) {
  const keywords = tokenize(idea).slice(0, 12);
  const matchedCategories = CATEGORY_RULES.map((rule) => {
    const hits = rule.match.filter((term) => idea.toLowerCase().includes(term.toLowerCase()));
    return { ...rule, hits };
  }).filter((rule) => rule.hits.length);

  const primaryCategory = matchedCategories[0]?.category ?? "待探索产品方向";
  const targetAudience = matchedCategories[0]?.audience ?? inferAudienceFromText(idea, "通用用户");
  const queryTerms = [...new Set([idea, ...keywords.slice(0, 4)])].filter(Boolean);
  const seedTerms = [...new Set((matchedCategories[0]?.seeds ?? CATEGORY_RULES[CATEGORY_RULES.length - 1].seeds).slice(0, 4))];
  const expandedQueries = [
    `${idea} 竞品 产品 工具`,
    `${idea} app 网站`,
    `${idea} alternatives products`,
    ...queryTerms.slice(1).map((term) => `${term} 工具 app`),
    ...seedTerms.map((term) => `${term} product app`),
  ].slice(0, 6);

  return {
    idea,
    keywords,
    primaryCategory,
    targetAudience,
    seedTerms,
    expandedQueries,
  };
}

function inferAudienceFromText(text, fallback = "通用用户") {
  const lower = text.toLowerCase();
  const audiences = [];
  const tests = [
    ["产品经理", ["产品经理", "pm", "需求", "路线图", "竞品"]],
    ["创业者", ["创业", "startup", "创始人", "founder"]],
    ["知识工作者", ["知识", "笔记", "文档", "办公", "效率", "搜索"]],
    ["创作者", ["创作", "写作", "视频", "内容", "设计", "海报"]],
    ["开发者", ["开发", "代码", "api", "sdk", "github"]],
    ["运营 / 市场", ["运营", "营销", "增长", "投放", "品牌"]],
    ["消费者", ["消费", "购物", "生活", "点评", "本地"]],
    ["学生", ["学生", "学习", "课程", "教育", "考试"]],
  ];

  for (const [audience, words] of tests) {
    if (words.some((word) => lower.includes(word))) audiences.push(audience);
  }

  return audiences.length ? audiences.slice(0, 3) : [fallback];
}

function classifyProduct(product, profile) {
  const haystack = `${product.name} ${product.subtitle ?? ""} ${product.description ?? ""} ${product.snippet ?? ""} ${
    product.url ?? ""
  }`.toLowerCase();
  const candidates = CATEGORY_RULES.map((rule) => {
    const hits = rule.match.filter((term) => haystack.includes(term.toLowerCase()));
    return { rule, hits, score: hits.length };
  }).sort((a, b) => b.score - a.score);

  const best = candidates[0]?.score ? candidates[0].rule : CATEGORY_RULES[CATEGORY_RULES.length - 1];
  const audience = [...new Set([...best.audience, ...inferAudienceFromText(haystack)].filter(Boolean))].slice(0, 3);
  const sharedKeywords = profile.keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
  const categoryOverlap = profile.primaryCategory === best.category ? 1 : 0;
  const sourceBoost = product.source === "ios" || product.source === "googlePlay" ? 4 : 0;
  const researchLeadPenalty = product.kind === "researchLead" ? -18 : 0;
  const score = Math.max(
    36,
    Math.min(
      96,
      45 + sharedKeywords.length * 9 + categoryOverlap * 12 + candidates[0]?.score * 5 + sourceBoost + researchLeadPenalty,
    ),
  );

  return {
    category: product.kind === "researchLead" ? "资料线索 / 工具目录" : best.category,
    audience: product.kind === "researchLead" ? ["产品经理", "研究人员"] : audience,
    similarityScore: score,
    sharedKeywords,
  };
}

function createSimilarityReason(product, profile, classification) {
  if (product.kind === "researchLead") {
    return `这是资料线索而不是直接竞品：它汇总了与「${profile.primaryCategory}」相关的产品或分析，可作为二级入口继续挖产品名单。`;
  }

  const shared = classification.sharedKeywords.slice(0, 4);
  const sourcePhrase = product.source === "web" ? "公开网页信息" : `${SOURCE_LABELS[product.source]} 简介`;
  if (shared.length) {
    return `命中了你想法中的「${shared.join("、")}」，并且从${sourcePhrase}看，核心场景同样落在「${
      classification.category
    }」；可优先验证它如何组织入口、留存和付费。`;
  }

  return `没有直接命中完整关键词，但从${sourcePhrase}看，它解决的问题与「${profile.primaryCategory}」相邻；适合作为边界竞品，观察用户需求是否外溢到该分类。`;
}

function normalizeProduct(product, profile) {
  const classification = classifyProduct(product, profile);
  const domain = getDomain(product.url);
  const publicFact = cleanText(product.snippet || product.description || product.subtitle || domain || product.name);
  const rawId = product.appId || product.url || domain || product.name;

  return {
    id: `${product.source}-${rawId}`.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-"),
    name: product.name,
    subtitle: product.subtitle || domain || SOURCE_LABELS[product.source],
    source: product.source,
    sourceLabel: SOURCE_LABELS[product.source],
    url: product.url,
    domain,
    icon: product.icon || "",
    category: classification.category,
    audience: classification.audience,
    similarityScore: classification.similarityScore,
    similarityReason: createSimilarityReason(product, profile, classification),
    publicFact,
    inferenceNote: `PM 推断：分类、人群和相似度由名称、简介、链接文本与输入想法的关键词匹配生成。`,
    opportunity: "待进一步体验验证。",
    risk: "公开资料有限，需进入产品核实。",
    raw: {
      kind: product.kind || "product",
      appId: product.appId || "",
      description: product.description || "",
      snippet: product.snippet || "",
      storeCountry: product.storeCountry || "",
    },
  };
}

function truncateText(value = "", max = 360) {
  const text = cleanText(value);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function safeJsonParse(content) {
  const cleaned = String(content)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("DeepSeek 返回内容不是可解析 JSON");
  }
}

async function callDeepSeek({ apiKey, model, messages, timeoutMs = 25000, jsonMode = true }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const body = {
    model: model || "deepseek-chat",
    messages,
    temperature: 0.2,
    max_tokens: 3600,
  };
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) {
      if (jsonMode && response.status >= 400 && response.status < 500) {
        return callDeepSeek({ apiKey, model, messages, timeoutMs, jsonMode: false });
      }
      throw new Error(`DeepSeek API ${response.status}: ${truncateText(text, 220)}`);
    }
    const payload = JSON.parse(text);
    return payload.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(timer);
  }
}

async function enrichWithDeepSeek({ apiKey, model, idea, profile, results }) {
  if (!apiKey) {
    return {
      provider: "rules",
      model: "local-rules",
      configured: false,
      executiveSummary: "当前未配置 DeepSeek API Key，已使用本地规则完成第一轮竞品发现与分类。",
      opportunities: ["补充 DeepSeek API Key 后，可获得更细的相似点、差异化机会和验证问题。"],
      questions: ["目标用户是否更偏个人知识管理、团队协作，还是 AI 搜索入口？"],
      results,
    };
  }

  const compactResults = results.slice(0, 28).map((item) => ({
    id: item.id,
    name: item.name,
    source: item.sourceLabel,
    url: item.url,
    category: item.category,
    audience: item.audience,
    similarityScore: item.similarityScore,
    publicFact: truncateText(item.publicFact, 260),
    description: truncateText(item.raw?.description || item.raw?.snippet || "", 260),
  }));

  const messages = [
    {
      role: "system",
      content:
        "你是资深产品经理和竞品研究员。请基于公开资料做谨慎分析，严格区分公开事实和 PM 推断。输出必须是合法 JSON，不要输出 Markdown。",
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task:
            "根据用户产品想法和候选产品列表，重排相似度，补充每个产品与想法的相似之处、目标人群、分类、机会点、风险点，并生成整体洞察。不要编造没有给出的事实；事实不足时明确说需要体验验证。",
          idea,
          detectedProfile: profile,
          products: compactResults,
          outputSchema: {
            executiveSummary: "一句话总结竞品格局",
            opportunities: ["机会点 1", "机会点 2", "机会点 3"],
            questions: ["下一步验证问题 1", "下一步验证问题 2"],
            products: [
              {
                id: "候选产品 id",
                category: "分类",
                audience: ["目标人群"],
                similarityScore: 0,
                similarityReason: "说明该产品与想法相似之处",
                publicFact: "只引用候选列表里的公开事实",
                inferenceNote: "PM 推断：说明推断依据",
                opportunity: "可以学习或避开的机会点",
                risk: "需要进一步验证的风险",
              },
            ],
          },
        },
        null,
        2,
      ),
    },
  ];

  const content = await callDeepSeek({ apiKey, model, messages });
  const analysis = safeJsonParse(content);
  const analyzedById = new Map((analysis.products || []).map((item) => [item.id, item]));
  const merged = results.map((item) => {
    const analyzed = analyzedById.get(item.id);
    if (!analyzed) return item;
    return {
      ...item,
      category: analyzed.category || item.category,
      audience: Array.isArray(analyzed.audience) && analyzed.audience.length ? analyzed.audience.slice(0, 4) : item.audience,
      similarityScore: Number.isFinite(Number(analyzed.similarityScore))
        ? Math.max(0, Math.min(99, Math.round(Number(analyzed.similarityScore))))
        : item.similarityScore,
      similarityReason: analyzed.similarityReason || item.similarityReason,
      publicFact: analyzed.publicFact || item.publicFact,
      inferenceNote: analyzed.inferenceNote || `PM 推断：DeepSeek 基于候选产品公开信息与输入想法进行相似度判断。`,
      opportunity: analyzed.opportunity || item.opportunity,
      risk: analyzed.risk || item.risk,
    };
  });

  return {
    provider: "deepseek",
    model: model || "deepseek-chat",
    configured: true,
    executiveSummary: analysis.executiveSummary || "DeepSeek 已完成竞品相似度与机会点分析。",
    opportunities: Array.isArray(analysis.opportunities) ? analysis.opportunities.slice(0, 5) : [],
    questions: Array.isArray(analysis.questions) ? analysis.questions.slice(0, 5) : [],
    results: merged.sort((a, b) => b.similarityScore - a.similarityScore),
  };
}

function dedupeProducts(products) {
  const seen = new Map();
  for (const item of products) {
    const domain = getDomain(item.url);
    const appId =
      item.appId ||
      (() => {
        try {
          const parsed = new URL(item.url);
          return parsed.searchParams.get("id") || parsed.pathname.match(/id(\d+)/)?.[1] || "";
        } catch {
          return "";
        }
      })();
    const key =
      item.source === "ios" || item.source === "googlePlay"
        ? `${item.source}-${appId || item.name}`
        : `${domain || item.name}`.toLowerCase();
    const previous = seen.get(key);
    const currentStrength = (item.description?.length ?? 0) + (item.kind === "researchLead" ? -500 : 0);
    const previousStrength = (previous?.description?.length ?? 0) + (previous?.kind === "researchLead" ? -500 : 0);
    if (!previous || currentStrength > previousStrength) {
      seen.set(key, item);
    }
  }
  return [...seen.values()];
}

function selectBalancedResults(results, selectedSources, limit) {
  const sorted = results.slice().sort((a, b) => b.similarityScore - a.similarityScore);
  const picked = [];
  const pickedIds = new Set();
  const quota = Math.max(4, Math.min(8, Math.floor(limit / Math.max(selectedSources.length, 1))));

  for (const source of selectedSources) {
    const sourceItems = sorted.filter((item) => item.source === source).slice(0, quota);
    for (const item of sourceItems) {
      if (pickedIds.has(item.id)) continue;
      picked.push(item);
      pickedIds.add(item.id);
    }
  }

  for (const item of sorted) {
    if (picked.length >= limit) break;
    if (pickedIds.has(item.id)) continue;
    picked.push(item);
    pickedIds.add(item.id);
  }

  return picked.slice(0, limit).sort((a, b) => b.similarityScore - a.similarityScore);
}

async function fetchJson(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/json,text/plain,*/*",
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function searchDuckDuckGo(query, source = "web", limit = 8) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const results = [];

  $(".result").each((_index, element) => {
    if (results.length >= limit) return;
    const link = $(element).find(".result__a").first();
    const name = cleanText(link.text());
    const href = normalizeDuckUrl(link.attr("href"));
    const snippet = cleanText($(element).find(".result__snippet").text());
    if (!name || !href || href.includes("duckduckgo.com/y.js")) return;
    const leadText = `${name} ${snippet} ${href}`.toLowerCase();
    const isResearchLead =
      source === "web" && RESEARCH_LEAD_PATTERNS.some((pattern) => leadText.includes(pattern.toLowerCase()));

    results.push({
      name,
      subtitle: getDomain(href),
      url: href,
      snippet,
      source,
      kind: isResearchLead ? "researchLead" : "product",
    });
  });

  return results;
}

async function searchBing(query, source = "web", limit = 8) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-CN`;
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const results = [];

  $("li.b_algo").each((_index, element) => {
    if (results.length >= limit) return;
    const link = $(element).find("h2 a").first();
    const name = cleanText(link.text());
    const href = normalizeBingUrl(link.attr("href"));
    const snippet = cleanText($(element).find(".b_caption p").first().text() || $(element).text());
    if (!name || !href || href.includes("bing.com/search")) return;
    const leadText = `${name} ${snippet} ${href}`.toLowerCase();
    const isResearchLead =
      source === "web" && RESEARCH_LEAD_PATTERNS.some((pattern) => leadText.includes(pattern.toLowerCase()));

    results.push({
      name,
      subtitle: getDomain(href),
      url: href,
      snippet,
      source,
      kind: isResearchLead ? "researchLead" : "product",
    });
  });

  return results;
}

async function searchAppStore(profile, limit = 10) {
  const terms = [...new Set([profile.idea, ...profile.keywords.slice(0, 3), ...profile.seedTerms])].slice(0, 7);
  const countries = ["cn", "us"];
  const batches = await Promise.allSettled(
    terms.flatMap((term) =>
      countries.map(async (country) => {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
          term,
        )}&country=${country}&entity=software&limit=${limit}&lang=zh_cn`;
        const data = await fetchJson(url);
        return (data.results ?? []).map((item) => ({
          name: item.trackName,
          subtitle: item.sellerName,
          url: item.trackViewUrl,
          icon: item.artworkUrl100,
          description: item.description,
          snippet: (item.genres ?? []).join(" / "),
          source: "ios",
          storeCountry: country.toUpperCase(),
          appId: String(item.trackId || ""),
        }));
      }),
    ),
  );

  return batches.flatMap((batch) => (batch.status === "fulfilled" ? batch.value : []));
}

async function searchWeb(profile) {
  const queries = [
    ...profile.expandedQueries.slice(0, 4),
    ...profile.seedTerms.map((term) => `${term} official website product`),
  ].slice(0, 7);
  const bingBatches = await Promise.allSettled(queries.map((query) => searchBing(query, "web", 7)));
  const bingResults = bingBatches.flatMap((batch) => (batch.status === "fulfilled" ? batch.value : []));

  if (bingResults.length >= 5) return bingResults;

  const duckBatches = await Promise.allSettled(queries.slice(0, 4).map((query) => searchDuckDuckGo(query, "web", 7)));
  return [...bingResults, ...duckBatches.flatMap((batch) => (batch.status === "fulfilled" ? batch.value : []))];
}

async function searchGooglePlay(profile) {
  const directResults = await searchGooglePlayDirect(profile).catch(() => []);
  const queries = [
    `site:play.google.com/store/apps/details ${profile.idea}`,
    ...profile.keywords.slice(0, 2).map((term) => `site:play.google.com/store/apps/details ${term}`),
  ];
  const batches = await Promise.allSettled(queries.map((query) => searchDuckDuckGo(query, "googlePlay", 6)));
  const searchResults = batches
    .flatMap((batch) => (batch.status === "fulfilled" ? batch.value : []))
    .filter((item) => item.url.includes("play.google.com/store/apps"));
  return [...directResults, ...searchResults];
}

async function searchGooglePlayDirect(profile, limit = 12) {
  const terms = [...new Set([profile.idea, ...profile.keywords.slice(0, 2), ...profile.seedTerms])].slice(0, 6);
  const batches = await Promise.allSettled(
    terms.map(async (term) => {
      const url = `https://play.google.com/store/search?q=${encodeURIComponent(term)}&c=apps&hl=zh_CN&gl=US`;
      const html = await fetchText(url);
      const $ = cheerio.load(html);
      const results = [];

      $("a[href^='/store/apps/details?id=']").each((_index, element) => {
        if (results.length >= limit) return;
        const href = $(element).attr("href") || "";
        const appId = new URL(href, "https://play.google.com").searchParams.get("id") || "";
        const name =
          cleanText($(element).find(".DdYX5").first().text()) ||
          cleanText($(element).find(".ubGTjb").first().text()) ||
          appId;
        const developer = cleanText($(element).find(".wMUdtb").first().text());
        const rating = cleanText($(element).find(".w2kbF").first().text());
        const icon = $(element).find("img.stzEZd").attr("src") || $(element).find("img").last().attr("src") || "";
        if (!appId || !name) return;

        results.push({
          name,
          subtitle: developer || appId,
          url: `https://play.google.com/store/apps/details?id=${appId}`,
          icon,
          description: `${developer ? `${developer} · ` : ""}${rating ? `${rating} 星 · ` : ""}Google Play 搜索结果`,
          snippet: `${developer || ""} ${rating ? `${rating} 星` : ""}`.trim(),
          source: "googlePlay",
          appId,
        });
      });

      return results;
    }),
  );

  return batches.flatMap((batch) => (batch.status === "fulfilled" ? batch.value : []));
}

function buildInsights(results, profile, sourceErrors) {
  const countBy = (field) =>
    [...results.reduce((map, item) => map.set(item[field], (map.get(item[field]) ?? 0) + 1), new Map())]
      .map(([name, count]) => ({ name, count, ratio: Math.round((count / Math.max(results.length, 1)) * 100) }))
      .sort((a, b) => b.count - a.count);

  const audienceMap = new Map();
  for (const item of results) {
    for (const audience of item.audience) {
      audienceMap.set(audience, (audienceMap.get(audience) ?? 0) + 1);
    }
  }

  const audiences = [...audienceMap]
    .map(([name, count]) => ({ name, count, ratio: Math.round((count / Math.max(results.length, 1)) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topProducts = results
    .slice()
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, 5)
    .map((item) => item.name);

  return {
    ideaCategory: profile.primaryCategory,
    keywords: profile.keywords,
    categories: countBy("category").slice(0, 8),
    audiences,
    sourceCoverage: countBy("sourceLabel"),
    topProducts,
    nextSteps: [
      "先打开相似度最高的 5 个产品，记录首屏定位、核心流程和收费入口。",
      "把相同分类下的竞品再做一轮功能拆解，区分基础能力和差异化能力。",
      "挑 2 个边界竞品观察替代场景，判断你的想法是否需要缩小或换人群。",
    ],
    sourceErrors,
  };
}

export async function runResearch({
  idea,
  sources = ["web", "ios", "googlePlay"],
  limit = 36,
  deepseekApiKey = "",
  deepseekModel = "deepseek-chat",
} = {}) {
  const normalizedSources = Array.isArray(sources) && sources.length ? sources : ["web", "ios", "googlePlay"];
  const profile = buildIdeaProfile(idea.trim());
  const sourceBatches = [];
  const sourceErrors = [];

  if (normalizedSources.includes("web")) {
    try {
      sourceBatches.push(await searchWeb(profile));
    } catch (error) {
      sourceErrors.push({ source: "Web 网站", message: error.message });
    }
  }

  if (normalizedSources.includes("ios")) {
    try {
      sourceBatches.push(await searchAppStore(profile));
    } catch (error) {
      sourceErrors.push({ source: "iOS App Store", message: error.message });
    }
  }

  if (normalizedSources.includes("googlePlay")) {
    try {
      sourceBatches.push(await searchGooglePlay(profile));
    } catch (error) {
      sourceErrors.push({ source: "Google Play", message: error.message });
    }
  }

  const rawProducts = dedupeProducts(sourceBatches.flat());
  const normalizedResults = rawProducts
    .map((item) => normalizeProduct(item, profile))
    .sort((a, b) => b.similarityScore - a.similarityScore);
  const preAnalysisResults = selectBalancedResults(normalizedResults, normalizedSources, limit);
  let modelAnalysis;
  try {
    modelAnalysis = await enrichWithDeepSeek({
      apiKey: deepseekApiKey,
      model: deepseekModel,
      idea: profile.idea,
      profile,
      results: preAnalysisResults,
    });
  } catch (error) {
    sourceErrors.push({ source: "DeepSeek API", message: error.message });
    modelAnalysis = await enrichWithDeepSeek({
      apiKey: "",
      model: "local-rules",
      idea: profile.idea,
      profile,
      results: preAnalysisResults,
    });
  }
  const results = modelAnalysis.results;
  const insights = buildInsights(results, profile, sourceErrors);
  insights.model = {
    provider: modelAnalysis.provider,
    model: modelAnalysis.model,
    configured: modelAnalysis.configured,
  };
  insights.executiveSummary = modelAnalysis.executiveSummary;
  insights.opportunities = modelAnalysis.opportunities;
  insights.questions = modelAnalysis.questions;

  return {
    idea: profile.idea,
    generatedAt: new Date().toISOString(),
    sources: normalizedSources.map((source) => SOURCE_LABELS[source]),
    profile,
    results,
    insights,
  };
}

if (process.argv[1]?.endsWith("research.js") && process.argv[2]) {
  runResearch({ idea: process.argv.slice(2).join(" ") })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
