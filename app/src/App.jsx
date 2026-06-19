import { useEffect, useMemo, useState } from "react";
import {
  AppWindow,
  ArrowUpDown,
  BarChart3,
  BookOpen,
  Check,
  ClipboardList,
  Download,
  ExternalLink,
  Filter,
  Globe2,
  Grid2X2,
  History,
  Info,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Settings,
  Smartphone,
  Sparkles,
  Star,
  Table2,
} from "lucide-react";

const SAMPLE_IDEA =
  "一款结合 AI 搜索和个人知识库的生产力工具，帮助用户快速找到答案并沉淀知识，支持多端同步和团队协作。";

const SOURCE_OPTIONS = [
  { id: "web", label: "Web 网站", icon: Globe2 },
  { id: "ios", label: "iOS App Store", icon: Smartphone },
  { id: "googlePlay", label: "Google Play", icon: Play },
];

const SOURCE_CLASS = {
  "Web 网站": "sourceWeb",
  "iOS App Store": "sourceIos",
  "Google Play": "sourcePlay",
};

const NAV_ITEMS = [
  { id: "explore", label: "探索", icon: Search },
  { id: "projects", label: "项目空间", icon: ClipboardList },
  { id: "compare", label: "对比分析", icon: BarChart3 },
  { id: "report", label: "洞察报告", icon: BookOpen },
  { id: "history", label: "历史记录", icon: History },
];

function formatTime(iso) {
  if (!iso) return "未运行";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function cnSourceName(source) {
  return {
    web: "Web 网站",
    ios: "iOS App Store",
    googlePlay: "Google Play",
  }[source];
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function makeMarkdown(data, visibleResults) {
  if (!data) return "";
  const lines = [
    `# 竞品调研：${data.idea}`,
    "",
    `生成时间：${formatTime(data.generatedAt)}`,
    `分析方式：${data.insights?.model?.provider === "deepseek" ? "DeepSeek API" : "本地规则"}`,
    `搜索来源：${data.sources.join("、")}`,
    "",
    "## 结论",
    data.insights?.executiveSummary || "暂无整体结论。",
    "",
    "## 机会点",
    ...(data.insights?.opportunities?.length ? data.insights.opportunities : ["继续补充真实体验后再判断。"]).map(
      (item) => `- ${item}`,
    ),
    "",
    "## 待验证问题",
    ...(data.insights?.questions?.length ? data.insights.questions : ["需要进入重点竞品体验核心路径。"]).map(
      (item) => `- ${item}`,
    ),
    "",
    "## 关键分类",
    ...data.insights.categories.map((item) => `- ${item.name}：${item.count} 个，占 ${item.ratio}%`),
    "",
    "## 目标人群",
    ...data.insights.audiences.map((item) => `- ${item.name}：${item.count} 次，占 ${item.ratio}%`),
    "",
    "## 竞品列表",
    ...visibleResults.map(
      (item, index) =>
        `${index + 1}. [${item.name}](${item.url})｜${item.sourceLabel}｜${item.category}｜目标人群：${item.audience.join(
          "、",
        )}｜相似度：${item.similarityScore}%\n   - 相似点：${item.similarityReason}\n   - 公开事实：${item.publicFact}\n   - 机会点：${item.opportunity || "待验证"}\n   - 风险点：${item.risk || "待验证"}\n   - ${item.inferenceNote}`,
    ),
    "",
    "## 下一步",
    ...data.insights.nextSteps.map((item) => `- ${item}`),
  ];
  return lines.join("\n");
}

function SourceIcon({ label }) {
  if (label === "iOS App Store") return <Smartphone size={15} />;
  if (label === "Google Play") return <Play size={15} />;
  return <Globe2 size={15} />;
}

function EmptyState({ onSample }) {
  return (
    <section className="emptyState">
      <div className="emptyIcon">
        <Search size={28} />
      </div>
      <h2>输入一个大概想法，就能拉出第一轮竞品池</h2>
      <p>系统会从网站和 App 搜索入口抓取公开信息，并生成相似点、人群、分类和体验链接。</p>
      <button type="button" className="secondaryButton" onClick={onSample}>
        使用示例想法
      </button>
    </section>
  );
}

function ProgressBar({ value }) {
  return (
    <div className="scoreWrap" aria-label={`相似度 ${value}%`}>
      <span>{value}%</span>
      <div className="scoreTrack">
        <div style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ResultRow({ item, viewMode, favorite, onToggleFavorite }) {
  const dense = viewMode === "table";
  return (
    <article className={dense ? "resultRow dense" : "resultRow"}>
      <div className="productCell">
        <div className="productIcon" aria-hidden="true">
          {item.icon ? <img src={item.icon} alt="" /> : <AppWindow size={22} />}
        </div>
        <div>
          <h3>{item.name}</h3>
          <p>{item.subtitle}</p>
        </div>
      </div>

      <div className="metaCell">
        <span className={`sourceBadge ${SOURCE_CLASS[item.sourceLabel] ?? ""}`}>
          <SourceIcon label={item.sourceLabel} />
          {item.sourceLabel}
        </span>
        <span>{item.category}</span>
      </div>

      <div className="audienceCell">
        {item.audience.map((audience) => (
          <span key={audience}>{audience}</span>
        ))}
      </div>

      <ProgressBar value={item.similarityScore} />

      <div className="reasonCell">
        <p>{item.similarityReason}</p>
        <small>公开事实：{item.publicFact}</small>
        <small>{item.inferenceNote}</small>
      </div>

      <div className="actionCell">
        <a href={item.url} target="_blank" rel="noreferrer" className="openButton">
          体验
          <ExternalLink size={14} />
        </a>
        <button
          type="button"
          className={favorite ? "favoriteActive" : ""}
          aria-label={favorite ? "取消收藏" : "加入收藏"}
          onClick={() => onToggleFavorite(item.id)}
        >
          <Star size={16} />
        </button>
      </div>
    </article>
  );
}

function DistributionList({ title, items, kind }) {
  return (
    <section className="insightBlock">
      <div className="insightTitle">
        <h3>{title}</h3>
        <span>Top {Math.min(items.length, 5)}</span>
      </div>
      <div className="bars">
        {items.slice(0, 5).map((item) => (
          <div className="barItem" key={item.name}>
            <div>
              <span>{item.name}</span>
              <strong>{item.ratio}%</strong>
            </div>
            <div className={`barTrack ${kind}`}>
              <div style={{ width: `${Math.max(item.ratio, 8)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function NoDataPanel({ onExplore }) {
  return (
    <section className="emptyState compactEmpty">
      <div className="emptyIcon">
        <Search size={26} />
      </div>
      <h2>先执行一次竞品探索</h2>
      <p>有了调研结果后，这里会自动生成对比、报告、历史和项目沉淀。</p>
      <button type="button" className="secondaryButton" onClick={onExplore}>
        去探索
      </button>
    </section>
  );
}

function App() {
  const [activeView, setActiveView] = useState("explore");
  const [idea, setIdea] = useState(SAMPLE_IDEA);
  const [selectedSources, setSelectedSources] = useState(["web", "ios", "googlePlay"]);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortMode, setSortMode] = useState("similarity");
  const [viewMode, setViewMode] = useState("table");
  const [history, setHistory] = useState(() => readStorage("competitor-radar-history", []));
  const [projects, setProjects] = useState(() => readStorage("competitor-radar-projects", []));
  const [favorites, setFavorites] = useState(() => new Set(readStorage("competitor-radar-favorites", [])));
  const [config, setConfig] = useState({ provider: "deepseek", model: "deepseek-chat", hasDeepSeekKey: false });

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then((payload) => setConfig(payload))
      .catch(() => {});
  }, []);

  useEffect(() => {
    writeStorage("competitor-radar-history", history);
  }, [history]);

  useEffect(() => {
    writeStorage("competitor-radar-projects", projects);
  }, [projects]);

  useEffect(() => {
    writeStorage("competitor-radar-favorites", [...favorites]);
  }, [favorites]);

  const categories = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.results.map((item) => item.category))].sort();
  }, [data]);

  const audiences = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.results.flatMap((item) => item.audience))].sort();
  }, [data]);

  const visibleResults = useMemo(() => {
    if (!data) return [];
    const filtered = data.results.filter((item) => {
      const categoryMatch = categoryFilter === "all" || item.category === categoryFilter;
      const audienceMatch = audienceFilter === "all" || item.audience.includes(audienceFilter);
      const sourceMatch = sourceFilter === "all" || item.sourceLabel === cnSourceName(sourceFilter);
      return categoryMatch && audienceMatch && sourceMatch;
    });

    return filtered.sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name, "zh-CN");
      if (sortMode === "category") return a.category.localeCompare(b.category, "zh-CN");
      return b.similarityScore - a.similarityScore;
    });
  }, [audienceFilter, categoryFilter, data, sortMode, sourceFilter]);

  const favoriteResults = useMemo(() => {
    if (!data) return [];
    return data.results.filter((item) => favorites.has(item.id));
  }, [data, favorites]);

  const runSearch = async () => {
    setStatus("loading");
    setError("");
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idea, sources: selectedSources, limit: 42 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || payload.detail || "搜索失败");
      setData(payload);
      setHistory((current) =>
        [
          { idea: payload.idea, time: payload.generatedAt, count: payload.results.length, data: payload },
          ...current.filter((item) => item.idea !== payload.idea),
        ].slice(0, 10),
      );
      setCategoryFilter("all");
      setAudienceFilter("all");
      setSourceFilter("all");
      setActiveView("explore");
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : String(searchError));
    } finally {
      setStatus("idle");
    }
  };

  const toggleSource = (id) => {
    setSelectedSources((current) => {
      if (current.includes(id) && current.length === 1) return current;
      if (current.includes(id)) return current.filter((item) => item !== id);
      return [...current, id];
    });
  };

  const toggleFavorite = (id) => {
    setFavorites((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exportMarkdown = () => {
    const content = makeMarkdown(data, visibleResults);
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `竞品调研-${new Date().toISOString().slice(0, 10)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const saveProject = () => {
    if (!data) return;
    const item = {
      id: `${Date.now()}`,
      title: data.idea.slice(0, 36),
      idea: data.idea,
      time: new Date().toISOString(),
      count: data.results.length,
      summary: data.insights?.executiveSummary || "暂无结论",
      data,
    };
    setProjects((current) => [item, ...current.filter((project) => project.idea !== data.idea)].slice(0, 12));
    setActiveView("projects");
  };

  const restoreResearch = (payload) => {
    setData(payload);
    setIdea(payload.idea);
    setActiveView("explore");
  };

  const navTitle = {
    explore: ["探索竞品", "输入想法后聚合网站和 App 线索，自动整理相似点、人群与分类。"],
    projects: ["项目空间", "沉淀已经跑过的调研项目，便于后续继续对比和复盘。"],
    compare: ["对比分析", "把高相关竞品放在同一张表里，看定位、人群、机会和风险。"],
    report: ["洞察报告", "生成可导出的结论、机会点、待验证问题和下一步建议。"],
    history: ["历史记录", "查看最近执行过的调研，并一键恢复到工作台。"],
    settings: ["项目设置", "查看 API 状态和部署说明。"],
  }[activeView];

  const modelLabel = data?.insights?.model?.provider === "deepseek" ? "DeepSeek 分析" : "本地规则分析";

  const renderExplore = () => (
    <>
      <section className="queryPanel">
        <div className="panelLabel">
          <span>输入你的产品想法</span>
          <Info size={16} />
        </div>
        <textarea
          value={idea}
          onChange={(event) => setIdea(event.target.value)}
          maxLength={1000}
          placeholder="例如：面向产品经理的 AI 竞品调研工具，可以自动找网站和 App，并生成相似点、人群、分类和体验链接。"
        />
        <div className="queryFooter">
          <div className="sourceSwitches" aria-label="选择搜索来源">
            <button
              type="button"
              className={selectedSources.length === SOURCE_OPTIONS.length ? "checked" : ""}
              onClick={() =>
                setSelectedSources((current) =>
                  current.length === SOURCE_OPTIONS.length ? ["web"] : SOURCE_OPTIONS.map((item) => item.id),
                )
              }
            >
              <Check size={16} />
              全选
            </button>
            {SOURCE_OPTIONS.map((source) => {
              const Icon = source.icon;
              return (
                <button
                  type="button"
                  key={source.id}
                  className={selectedSources.includes(source.id) ? "checked" : ""}
                  onClick={() => toggleSource(source.id)}
                >
                  <Icon size={16} />
                  {source.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="primaryButton"
            onClick={runSearch}
            disabled={status === "loading" || idea.trim().length < 2}
          >
            {status === "loading" ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
            {status === "loading" ? "分析中" : "开始搜索"}
          </button>
        </div>
        {error && <div className="errorLine">{error}</div>}
      </section>

      <section className="filterPanel">
        <div className="filterTitle">
          <Filter size={17} />
          筛选条件
        </div>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="all">全部分类</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select value={audienceFilter} onChange={(event) => setAudienceFilter(event.target.value)}>
          <option value="all">全部目标人群</option>
          {audiences.map((audience) => (
            <option key={audience} value={audience}>
              {audience}
            </option>
          ))}
        </select>
        <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
          <option value="all">全部来源</option>
          {SOURCE_OPTIONS.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label}
            </option>
          ))}
        </select>
        <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
          <option value="similarity">相似度从高到低</option>
          <option value="category">按分类排序</option>
          <option value="name">按名称排序</option>
        </select>
        <button type="button" onClick={() => setViewMode(viewMode === "table" ? "grid" : "table")}>
          {viewMode === "table" ? <Grid2X2 size={16} /> : <Table2 size={16} />}
          {viewMode === "table" ? "紧凑视图" : "列表视图"}
        </button>
      </section>

      <section className="resultsPanel">
        <div className="resultHeader">
          <div>
            <span>{data ? `找到 ${visibleResults.length} / ${data.results.length} 个结果` : "等待搜索"}</span>
            <p>
              {data
                ? `最近运行：${formatTime(data.generatedAt)} · ${modelLabel}`
                : "公开搜索结果会在这里变成可筛选竞品池。"}
            </p>
          </div>
          <div className="sortNote">
            <ArrowUpDown size={15} />
            {sortMode === "similarity" ? "相似度优先" : sortMode === "category" ? "分类聚合" : "名称排序"}
          </div>
        </div>

        {!data && <EmptyState onSample={() => setIdea(SAMPLE_IDEA)} />}

        {data && (
          <div className={viewMode === "table" ? "resultList tableMode" : "resultList gridMode"}>
            {visibleResults.map((item) => (
              <ResultRow
                key={item.id}
                item={item}
                viewMode={viewMode}
                favorite={favorites.has(item.id)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );

  const renderProjects = () => (
    <section className="secondaryPanel">
      <div className="panelActionRow">
        <div>
          <h2>调研项目</h2>
          <p>把当前调研保存成项目，后续可恢复继续分析。</p>
        </div>
        <button type="button" className="primaryButton slim" disabled={!data} onClick={saveProject}>
          保存当前调研
        </button>
      </div>
      {projects.length === 0 ? (
        <NoDataPanel onExplore={() => setActiveView("explore")} />
      ) : (
        <div className="projectGrid">
          {projects.map((project) => (
            <button type="button" key={project.id} className="projectCard" onClick={() => restoreResearch(project.data)}>
              <strong>{project.title}</strong>
              <span>{formatTime(project.time)} · {project.count} 个候选竞品</span>
              <p>{project.summary}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );

  const renderCompare = () => {
    if (!data) return <NoDataPanel onExplore={() => setActiveView("explore")} />;
    const compareRows = visibleResults.slice(0, 10);
    return (
      <section className="secondaryPanel">
        <div className="panelActionRow">
          <div>
            <h2>竞品对比矩阵</h2>
            <p>默认取当前筛选下相似度最高的 10 个产品。</p>
          </div>
          <button type="button" className="secondaryButton" onClick={() => setActiveView("report")}>
            生成报告
          </button>
        </div>
        <div className="comparisonTable">
          <div className="comparisonHead">
            <span>产品</span>
            <span>分类 / 人群</span>
            <span>相似点</span>
            <span>机会 / 风险</span>
            <span>入口</span>
          </div>
          {compareRows.map((item) => (
            <div className="comparisonRow" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <small>{item.sourceLabel} · {item.similarityScore}%</small>
              </div>
              <div>
                <span>{item.category}</span>
                <small>{item.audience.join("、")}</small>
              </div>
              <p>{item.similarityReason}</p>
              <p>{item.opportunity || "机会点待验证"} / {item.risk || "风险待验证"}</p>
              <a href={item.url} target="_blank" rel="noreferrer">
                体验 <ExternalLink size={13} />
              </a>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const renderReport = () => {
    if (!data) return <NoDataPanel onExplore={() => setActiveView("explore")} />;
    return (
      <section className="secondaryPanel reportPanel">
        <div className="panelActionRow">
          <div>
            <h2>竞品洞察报告</h2>
            <p>{data.insights.executiveSummary}</p>
          </div>
          <button type="button" className="primaryButton slim" onClick={exportMarkdown}>
            <Download size={16} />
            导出 Markdown
          </button>
        </div>
        <div className="reportGrid">
          <section>
            <h3>机会点</h3>
            {(data.insights.opportunities?.length ? data.insights.opportunities : ["补充 DeepSeek Key 后可获得更细机会判断。"]).map(
              (item) => <p key={item}>• {item}</p>,
            )}
          </section>
          <section>
            <h3>待验证问题</h3>
            {(data.insights.questions?.length ? data.insights.questions : ["进入重点竞品体验核心路径。"]).map((item) => (
              <p key={item}>• {item}</p>
            ))}
          </section>
        </div>
        <div className="reportList">
          {visibleResults.slice(0, 8).map((item) => (
            <article key={item.id}>
              <h3>{item.name}</h3>
              <p>{item.similarityReason}</p>
              <small>公开事实：{item.publicFact}</small>
              <small>机会：{item.opportunity}</small>
              <small>风险：{item.risk}</small>
            </article>
          ))}
        </div>
      </section>
    );
  };

  const renderHistory = () => (
    <section className="secondaryPanel">
      <div className="panelActionRow">
        <div>
          <h2>执行历史</h2>
          <p>这里记录最近 10 次调研，可直接恢复结果。</p>
        </div>
        <button type="button" className="secondaryButton" onClick={() => setHistory([])} disabled={history.length === 0}>
          清空历史
        </button>
      </div>
      {history.length === 0 ? (
        <NoDataPanel onExplore={() => setActiveView("explore")} />
      ) : (
        <div className="historyListFull">
          {history.map((item) => (
            <button type="button" key={`${item.idea}-${item.time}`} onClick={() => restoreResearch(item.data)}>
              <strong>{item.idea}</strong>
              <span>{formatTime(item.time)} · {item.count} 个候选竞品</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );

  const renderSettings = () => (
    <section className="secondaryPanel settingsPanel">
      <h2>API 与部署设置</h2>
      <div className="settingsGrid">
        <section>
          <h3>模型状态</h3>
          <p>默认模型：{config.model || "deepseek-chat"}</p>
          <p>DeepSeek Key：{config.hasDeepSeekKey ? "已在后端配置" : "未配置，当前使用本地规则兜底"}</p>
        </section>
        <section>
          <h3>安全说明</h3>
          <p>线上版通过 Cloudflare Worker 调用 DeepSeek，API Key 应通过 Worker Secret 配置，不会出现在前端代码或 GitHub 仓库中。</p>
        </section>
        <section>
          <h3>能力说明</h3>
          <p>已支持 Web / iOS App Store / Google Play 搜索入口、模型分析、竞品对比、报告导出、项目保存和历史恢复。</p>
        </section>
      </div>
    </section>
  );

  const renderActiveView = () => {
    if (activeView === "projects") return renderProjects();
    if (activeView === "compare") return renderCompare();
    if (activeView === "report") return renderReport();
    if (activeView === "history") return renderHistory();
    if (activeView === "settings") return renderSettings();
    return renderExplore();
  };

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">
            <Sparkles size={22} />
          </div>
          <span>竞品雷达</span>
        </div>
        <nav>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                className={activeView === item.id ? "active" : ""}
                onClick={() => setActiveView(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebarBottom">
          <label>
            当前项目
            <select>
              <option>个人项目</option>
              <option>新产品验证</option>
            </select>
          </label>
          <button type="button" className={activeView === "settings" ? "activeLite" : ""} onClick={() => setActiveView("settings")}>
            <Settings size={17} />
            项目设置
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>{navTitle[0]}</h1>
            <p>{navTitle[1]}</p>
          </div>
          <div className="topbarActions">
            <button type="button" onClick={() => setIdea(SAMPLE_IDEA)}>
              <RefreshCw size={16} />
              示例想法
            </button>
            <button type="button" disabled={!data} onClick={saveProject}>
              <ClipboardList size={16} />
              保存项目
            </button>
            <button type="button" disabled={!data} onClick={exportMarkdown}>
              <Download size={16} />
              导出报告
            </button>
          </div>
        </header>

        {renderActiveView()}
      </main>

      <aside className="insights">
        <div className="insightTop">
          <div>
            <h2>洞察概览</h2>
            <p>{data ? data.profile.primaryCategory : "搜索后生成"}</p>
          </div>
          <button type="button" onClick={runSearch} disabled={status === "loading" || idea.trim().length < 2}>
            <RefreshCw size={16} />
          </button>
        </div>

        {data ? (
          <>
            <section className="summaryCard">
              <strong>{data.results.length}</strong>
              <span>个候选竞品</span>
              <p>{data.insights.topProducts.length ? `优先看：${data.insights.topProducts.join("、")}` : "暂无结果"}</p>
              <small>{modelLabel} · 收藏 {favoriteResults.length} 个</small>
            </section>
            <section className={config.hasDeepSeekKey ? "modelBlock ok" : "modelBlock"}>
              <strong>{config.hasDeepSeekKey ? "DeepSeek 已接入" : "DeepSeek 待配置"}</strong>
              <p>{config.hasDeepSeekKey ? `后端默认调用 ${config.model}` : "当前先使用本地规则兜底。配置 secret 后会自动切换模型分析。"}</p>
            </section>
            <DistributionList title="分类分布" items={data.insights.categories} kind="blue" />
            <DistributionList title="目标人群" items={data.insights.audiences} kind="green" />
            <section className="insightBlock">
              <div className="insightTitle">
                <h3>关键词</h3>
                <span>{data.profile.keywords.length}</span>
              </div>
              <div className="keywordCloud">
                {data.profile.keywords.slice(0, 10).map((keyword) => (
                  <span key={keyword}>{keyword}</span>
                ))}
              </div>
            </section>
            <section className="insightBlock">
              <div className="insightTitle">
                <h3>下一步建议</h3>
                <span>{data.insights.nextSteps.length}</span>
              </div>
              <div className="nextSteps">
                {data.insights.nextSteps.map((step) => (
                  <div key={step}>
                    <Check size={15} />
                    <p>{step}</p>
                  </div>
                ))}
              </div>
            </section>
            {data.insights.sourceErrors.length > 0 && (
              <section className="warningBlock">
                <strong>部分来源失败</strong>
                {data.insights.sourceErrors.map((item) => (
                  <p key={`${item.source}-${item.message}`}>
                    {item.source}：{item.message}
                  </p>
                ))}
              </section>
            )}
          </>
        ) : (
          <div className="historyBlock">
            <h3>执行入口</h3>
            <p>先在“探索”里输入想法并点击开始搜索。</p>
            <section className={config.hasDeepSeekKey ? "modelBlock ok" : "modelBlock"}>
              <strong>{config.hasDeepSeekKey ? "DeepSeek 已接入" : "DeepSeek 待配置"}</strong>
              <p>{config.hasDeepSeekKey ? `默认模型：${config.model}` : "待你提供 Key 后，我会把它写入 Worker Secret。"}</p>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

export default App;
