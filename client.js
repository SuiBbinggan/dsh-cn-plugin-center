window.__ModuleLoader__.load({
  id: "dsh-cn-plugin-center",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const NS = "settings.cnPluginCenter";
    const API = "/cn-plugin-center/api";
    const MIRROR_LABELS_ZH = {
      npmmirror: "npmmirror",
      huawei: "华为云",
      tencent: "腾讯云",
      npmjs: "npm 官方"
    };

    const zh = {
      tab: "插件中心",
      loading: "正在读取插件目录...",
      loadFailed: "插件目录读取失败",
      retry: "重试",
      sourceTitle: "下载源",
      source: "npm 镜像",
      customSource: "自定义 HTTPS 地址",
      test: "测速",
      testing: "测速中...",
      save: "保存源设置",
      saving: "保存中...",
      sourceReady: "可用",
      sourceFailed: "不可用",
      latency: "延迟",
      officialIntegrity: "Harness 包完整性一致",
      githubProxy: "GitHub 本地代理",
      githubProxyUrl: "本地代理地址",
      proxyPlaceholder: "http://127.0.0.1:7890",
      restartRequired: "插件已变更，请重启 DeepSeek Harness 后生效。",
      catalogTitle: "精选插件",
      catalogAllTitle: "全部插件",
      searchResultsTitle: "搜索结果",
      search: "搜索插件",
      searchPlaceholder: "搜索精选和社区插件",
      category: "分类",
      allCategories: "全部分类",
      empty: "没有匹配的插件",
      expandAll: "展开全部插件",
      curatedOnly: "只看精选",
      loadingCommunity: "正在验证社区插件，首次加载可能需要几秒...",
      communityFailed: "社区插件加载失败",
      community: "社区",
      featured: "推荐",
      installed: "已安装",
      active: "已启用",
      pendingRestart: "待重启",
      version: "推荐版本",
      installedVersion: "已装版本",
      sourceCode: "源码",
      install: "安装",
      installing: "安装中...",
      update: "更新",
      updating: "更新中...",
      remove: "卸载",
      removing: "卸载中...",
      operationLog: "最近操作",
      closeLog: "关闭",
      thirdPartyNotice: "第三方插件未经 DeepSeek 官方审核。安装前请查看源码与权限。",
      installConfirm: "确定安装这个第三方插件？安装完成后需要重启。",
      updateConfirm: "确定更新这个第三方插件？更新完成后需要重启。",
      removeConfirm: "确定卸载这个插件？卸载完成后需要重启。",
      count: "个插件",
      previousPage: "上一页",
      nextPage: "下一页",
      page: "第",
      pageOf: "页，共",
      pages: "页",
      jumpPlaceholder: "页码",
      jump: "跳转"
    };

    const en = {
      tab: "Plugin Center",
      loading: "Loading plugin catalog...",
      loadFailed: "Could not load the plugin catalog",
      retry: "Retry",
      sourceTitle: "Download source",
      source: "npm registry",
      customSource: "Custom HTTPS URL",
      test: "Test",
      testing: "Testing...",
      save: "Save source settings",
      saving: "Saving...",
      sourceReady: "Available",
      sourceFailed: "Unavailable",
      latency: "Latency",
      officialIntegrity: "Harness package integrity matches",
      githubProxy: "Local GitHub proxy",
      githubProxyUrl: "Local proxy URL",
      proxyPlaceholder: "http://127.0.0.1:7890",
      restartRequired: "Plugins changed. Restart DeepSeek Harness to apply them.",
      catalogTitle: "Curated plugins",
      catalogAllTitle: "All plugins",
      searchResultsTitle: "Search results",
      search: "Search plugins",
      searchPlaceholder: "Search curated and community plugins",
      category: "Category",
      allCategories: "All categories",
      empty: "No matching plugins",
      expandAll: "Show all plugins",
      curatedOnly: "Curated only",
      loadingCommunity: "Verifying community plugins. The first load may take a few seconds...",
      communityFailed: "Could not load community plugins",
      community: "Community",
      featured: "Featured",
      installed: "Installed",
      active: "Active",
      pendingRestart: "Restart pending",
      version: "Recommended",
      installedVersion: "Installed",
      sourceCode: "Source",
      install: "Install",
      installing: "Installing...",
      update: "Update",
      updating: "Updating...",
      remove: "Remove",
      removing: "Removing...",
      operationLog: "Latest operation",
      closeLog: "Close",
      thirdPartyNotice: "Third-party plugins are not reviewed by DeepSeek. Check their source and permissions before installing.",
      installConfirm: "Install this third-party plugin? A restart will be required.",
      updateConfirm: "Update this third-party plugin? A restart will be required.",
      removeConfirm: "Remove this plugin? A restart will be required.",
      count: "plugins",
      previousPage: "Previous page",
      nextPage: "Next page",
      page: "Page",
      pageOf: "of",
      pages: "pages",
      jumpPlaceholder: "Page",
      jump: "Go"
    };

    const css = `
      .cnpc-root{box-sizing:border-box;width:100%;max-width:980px;color:var(--dsw-alias-label-primary,#202124);display:flex;flex-direction:column;gap:20px;padding-bottom:24px}
      .cnpc-root *{box-sizing:border-box;letter-spacing:0}
      .cnpc-source{display:flex;flex-direction:column;gap:12px;padding:2px 0 18px;border-bottom:1px solid var(--dsw-alias-border-l2,#e5e7eb)}
      .cnpc-heading{margin:0;font-size:14px;line-height:22px;font-weight:650}
      .cnpc-source-grid{display:grid;grid-template-columns:minmax(190px,1fr) minmax(220px,1.5fr) auto;gap:10px;align-items:end}
      .cnpc-field{min-width:0;display:flex;flex-direction:column;gap:6px}
      .cnpc-field>span{color:var(--dsw-alias-label-secondary,#5f6368);font-size:12px;line-height:18px}
      .cnpc-input,.cnpc-select{width:100%;height:36px;border:1px solid var(--dsw-alias-border-l2,#d1d5db);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#202124);font:inherit;font-size:13px;outline:none;padding:0 10px}
      .cnpc-input:focus-visible,.cnpc-select:focus-visible{border-color:var(--dsw-alias-state-business-primary,#2563eb);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary,#2563eb) 18%,transparent)}
      .cnpc-input:disabled,.cnpc-select:disabled{opacity:.55;cursor:not-allowed}
      .cnpc-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .cnpc-button{height:34px;border:1px solid var(--dsw-alias-border-l2,#d1d5db);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#202124);font:inherit;font-size:13px;font-weight:550;cursor:pointer;padding:0 12px;white-space:nowrap}
      .cnpc-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#f3f4f6)}
      .cnpc-button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#2563eb);outline-offset:2px}
      .cnpc-button:disabled{opacity:.5;cursor:not-allowed}
      .cnpc-primary{border-color:var(--dsw-alias-state-business-primary,#2563eb);background:var(--dsw-alias-state-business-primary,#2563eb);color:#fff}
      .cnpc-primary:hover:not(:disabled){filter:brightness(.95);background:var(--dsw-alias-state-business-primary,#2563eb)}
      .cnpc-danger{color:var(--dsw-alias-state-error-primary,#c62828)}
      .cnpc-proxy-row{display:grid;grid-template-columns:auto minmax(220px,420px);gap:12px;align-items:center}
      .cnpc-check{display:inline-flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary,#5f6368);font-size:13px;cursor:pointer;white-space:nowrap}
      .cnpc-check input{width:16px;height:16px;margin:0;accent-color:var(--dsw-alias-state-business-primary,#2563eb)}
      .cnpc-status{min-height:20px;color:var(--dsw-alias-label-secondary,#5f6368);font-size:12px;line-height:20px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .cnpc-status[data-kind=success]{color:var(--dsw-alias-state-success-primary,#188038)}
      .cnpc-status[data-kind=error]{color:var(--dsw-alias-state-error-primary,#c62828)}
      .cnpc-restart{border-left:3px solid var(--dsw-alias-state-warning-primary,#b06000);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#b06000) 9%,transparent);color:var(--dsw-alias-label-primary,#202124);padding:9px 12px;font-size:13px;line-height:20px}
      .cnpc-catalog{display:flex;flex-direction:column;gap:12px}
      .cnpc-catalog-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline}
      .cnpc-catalog-head-main{display:flex;align-items:baseline;gap:10px;min-width:0}
      .cnpc-catalog-head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .cnpc-count{color:var(--dsw-alias-label-tertiary,#70757a);font-size:12px}
      .cnpc-filters{display:grid;grid-template-columns:minmax(220px,1fr) minmax(150px,220px);gap:10px}
      .cnpc-filters[data-wide=true]{grid-template-columns:minmax(220px,1fr)}
      .cnpc-notice{margin:0;color:var(--dsw-alias-state-warning-primary,#8a4b00);font-size:12px;line-height:19px}
      .cnpc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .cnpc-card{min-width:0;border:1px solid var(--dsw-alias-border-l2,#e0e0e0);border-radius:7px;background:var(--dsw-alias-bg-layer-3,#fff);padding:14px;display:flex;flex-direction:column;gap:11px}
      .cnpc-card-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .cnpc-title-wrap{min-width:0;display:flex;flex-direction:column;gap:2px}
      .cnpc-title{margin:0;font-size:14px;line-height:20px;font-weight:650;overflow-wrap:anywhere}
      .cnpc-package{color:var(--dsw-alias-label-tertiary,#70757a);font-family:var(--ds-font-family-code,monospace);font-size:11px;line-height:17px;overflow-wrap:anywhere}
      .cnpc-badges{display:flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
      .cnpc-badge{border-radius:5px;background:var(--dsw-alias-bg-layer-1,#f3f4f6);color:var(--dsw-alias-label-secondary,#5f6368);font-size:11px;line-height:18px;padding:0 6px;white-space:nowrap}
      .cnpc-badge[data-kind=active]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#188038) 10%,transparent);color:var(--dsw-alias-state-success-primary,#188038)}
      .cnpc-badge[data-kind=review]{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#b06000) 10%,transparent);color:var(--dsw-alias-state-warning-primary,#8a4b00)}
      .cnpc-badge[data-kind=community]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#2563eb) 10%,transparent);color:var(--dsw-alias-state-business-primary,#2563eb)}
      .cnpc-description{margin:0;min-height:38px;color:var(--dsw-alias-label-secondary,#5f6368);font-size:12px;line-height:19px}
      .cnpc-meta{display:flex;gap:12px;flex-wrap:wrap;color:var(--dsw-alias-label-tertiary,#70757a);font-size:11px;line-height:18px}
      .cnpc-card-actions{margin-top:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .cnpc-link{color:var(--dsw-alias-state-business-primary,#2563eb);font-size:12px;text-decoration:none;margin-left:auto}
      .cnpc-link:hover{text-decoration:underline}
      .cnpc-empty,.cnpc-loading,.cnpc-error{min-height:100px;display:flex;align-items:center;justify-content:center;gap:10px;color:var(--dsw-alias-label-tertiary,#70757a);font-size:13px;text-align:center}
      .cnpc-error{color:var(--dsw-alias-state-error-primary,#c62828)}
      .cnpc-expand{display:flex;justify-content:center;padding:6px 0 2px}
      .cnpc-pagination{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;padding-top:6px}
      .cnpc-page-button{width:34px;height:34px;padding:0;border:1px solid var(--dsw-alias-border-l2,#d1d5db);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#202124);font:inherit;font-size:12px;cursor:pointer}
      .cnpc-page-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#f3f4f6)}
      .cnpc-page-button[aria-current=page]{border-color:var(--dsw-alias-state-business-primary,#2563eb);background:var(--dsw-alias-state-business-primary,#2563eb);color:#fff}
      .cnpc-page-button:disabled{opacity:.45;cursor:not-allowed}
      .cnpc-page-ellipsis{width:20px;text-align:center;color:var(--dsw-alias-label-tertiary,#70757a);font-size:12px}
      .cnpc-page-status{color:var(--dsw-alias-label-tertiary,#70757a);font-size:12px;white-space:nowrap;margin:0 4px}
      .cnpc-jump{display:flex;align-items:center;gap:6px;margin-left:4px}
      .cnpc-page-input{width:68px;height:34px;border:1px solid var(--dsw-alias-border-l2,#d1d5db);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#202124);font:inherit;font-size:12px;outline:none;padding:0 8px}
      .cnpc-page-input:focus-visible{border-color:var(--dsw-alias-state-business-primary,#2563eb);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary,#2563eb) 18%,transparent)}
      .cnpc-log{border-top:1px solid var(--dsw-alias-border-l2,#e5e7eb);padding-top:12px;display:flex;flex-direction:column;gap:8px}
      .cnpc-log-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
      .cnpc-log pre{max-height:180px;overflow:auto;margin:0;border-radius:6px;background:var(--dsw-alias-bg-module-platform,#f6f7f8);color:var(--dsw-alias-label-secondary,#444);font-family:var(--ds-font-family-code,monospace);font-size:11px;line-height:17px;white-space:pre-wrap;overflow-wrap:anywhere;padding:10px}
      @media (max-width:760px){.cnpc-source-grid{grid-template-columns:1fr}.cnpc-source-grid .cnpc-actions{align-self:start}.cnpc-proxy-row{grid-template-columns:1fr}.cnpc-grid{grid-template-columns:1fr}.cnpc-filters{grid-template-columns:1fr}.cnpc-description{min-height:0}}
      @media (max-width:520px){[role="dialog"]:has(.cnpc-root){flex-direction:column}[role="dialog"]:has(.cnpc-root)>nav{width:100%;height:auto;min-height:0;flex:none;border-right:0;border-bottom:1px solid var(--dsw-alias-border-l2,#e5e7eb);padding:8px 12px}[role="dialog"]:has(.cnpc-root)>nav>div:first-child{display:none}[role="dialog"]:has(.cnpc-root)>nav>div:last-child{display:flex;flex-direction:row;gap:4px;overflow-x:auto}[role="dialog"]:has(.cnpc-root)>nav button{width:auto;min-width:max-content;flex:none}[role="dialog"]:has(.cnpc-root)>:not(nav){width:100%;min-width:0;min-height:0;flex:1}.cnpc-button{max-width:100%;height:auto;min-height:34px;white-space:normal}.cnpc-actions{align-items:stretch}.cnpc-actions .cnpc-button{flex:1 1 100px}.cnpc-card-top{flex-direction:column}.cnpc-badges{justify-content:flex-start}.cnpc-link{margin-left:0}.cnpc-catalog-head{align-items:flex-start}.cnpc-catalog-head-main{flex-direction:column;gap:2px}.cnpc-pagination{gap:2px}.cnpc-page-button{width:26px;height:30px}.cnpc-page-ellipsis{width:12px}.cnpc-page-status{width:100%;text-align:center}.cnpc-jump{width:100%;justify-content:center;margin-left:0}.cnpc-expand .cnpc-button{width:100%}}
    `;

    const styleId = "dsh-cn-plugin-center/client";
    if (typeof document !== "undefined" && !document.querySelector(`style[data-plugin-css="${styleId}"]`)) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-cn-plugin-center";
      tag.dataset.pluginCss = styleId;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    function h(type, props, ...children) {
      return React.createElement(type, props, ...children);
    }

    async function api(path, options = {}) {
      const headers = { Accept: "application/json", ...(options.headers || {}) };
      if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
        headers["x-dsh-cn-plugin-center"] = "1";
      }
      const response = await fetch(`${API}${path}`, { ...options, headers });
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error(`HTTP ${response.status}`);
      }
      if (!response.ok || payload.ok === false) {
        const error = payload && payload.error;
        const message = typeof error === "string" ? error : error && error.message;
        const failure = new Error(message || `HTTP ${response.status}`);
        failure.details = error && error.details;
        throw failure;
      }
      return payload.data !== undefined ? payload.data : payload;
    }

    function normalizeState(data) {
      return {
        catalogUpdatedAt: data.catalogUpdatedAt || "",
        mirrors: Array.isArray(data.mirrors) ? data.mirrors : [],
        source: data.source || {},
        plugins: Array.isArray(data.plugins) ? data.plugins : [],
        busy: Boolean(data.busy),
        restartRequired: Boolean(data.restartRequired)
      };
    }

    function PluginCard({ plugin, busyId, t, onOperate }) {
      const compatibility = plugin.compatibility || {};
      const installed = Boolean(plugin.installed);
      const active = Boolean(plugin.active);
      const working = busyId === plugin.id;
      const localeIsZh = t("tab") === zh.tab;
      const description = localeIsZh ? plugin.description : plugin.descriptionEn || plugin.description;
      const category = localeIsZh ? plugin.category : plugin.categoryEn || plugin.category;
      const compatibilityLabel = localeIsZh ? compatibility.label : compatibility.labelEn || compatibility.label;
      const compatibilityNote = localeIsZh ? compatibility.note : compatibility.noteEn || compatibility.note;
      const action = !installed ? "install" : plugin.updateAvailable ? "update" : null;
      const actionLabel = working
        ? t(action === "update" ? "updating" : installed ? "removing" : "installing")
        : action === "update" ? t("update") : t("install");

      return h("article", { className: "cnpc-card" },
        h("div", { className: "cnpc-card-top" },
          h("div", { className: "cnpc-title-wrap" },
            h("h4", { className: "cnpc-title" }, plugin.name),
            h("span", { className: "cnpc-package" }, plugin.id)
          ),
          h("div", { className: "cnpc-badges" },
            plugin.featured ? h("span", { className: "cnpc-badge" }, t("featured")) : null,
            plugin.origin === "community" ? h("span", { className: "cnpc-badge", "data-kind": "community" }, t("community")) : null,
            h("span", { className: "cnpc-badge", "data-kind": compatibility.level === "review" ? "review" : "active", title: compatibilityNote || "" }, compatibilityLabel || ""),
            installed ? h("span", { className: "cnpc-badge", "data-kind": active ? "active" : "review" }, active ? t("active") : t("pendingRestart")) : null
          )
        ),
        h("p", { className: "cnpc-description" }, description),
        h("div", { className: "cnpc-meta" },
          h("span", null, category),
          h("span", null, `${t("version")}: ${plugin.version}`),
          installed && plugin.installedVersion ? h("span", null, `${t("installedVersion")}: ${plugin.installedVersion}`) : null
        ),
        h("div", { className: "cnpc-card-actions" },
          action ? h("button", {
            type: "button",
            className: "cnpc-button cnpc-primary",
            disabled: Boolean(busyId),
            onClick: () => onOperate(plugin, action)
          }, actionLabel) : null,
          installed ? h("button", {
            type: "button",
            className: "cnpc-button cnpc-danger",
            disabled: Boolean(busyId),
            onClick: () => onOperate(plugin, "remove")
          }, working ? t("removing") : t("remove")) : null,
          h("a", { className: "cnpc-link", href: plugin.repository, target: "_blank", rel: "noreferrer" }, t("sourceCode"))
        )
      );
    }

    function paginationTokens(current, total) {
      const pages = new Set([1, total]);
      if (current <= 4) {
        for (let page = 1; page <= Math.min(4, total); page += 1) pages.add(page);
      } else if (current >= total - 3) {
        for (let page = Math.max(1, total - 3); page <= total; page += 1) pages.add(page);
      } else {
        for (let page = current - 1; page <= current + 1; page += 1) pages.add(page);
      }
      const sorted = [...pages].filter((page) => page > 0 && page <= total).sort((a, b) => a - b);
      const tokens = [];
      sorted.forEach((page, index) => {
        if (index > 0 && page - sorted[index - 1] > 1) tokens.push(`ellipsis-${page}`);
        tokens.push(page);
      });
      return tokens;
    }

    function Pagination({ current, total, onPage, t }) {
      const [jump, setJump] = React.useState("");
      React.useEffect(() => setJump(""), [current, total]);
      if (total < 1) return null;

      const submit = (event) => {
        event.preventDefault();
        const requested = Number(jump);
        if (!Number.isInteger(requested) || requested < 1 || requested > total) return;
        onPage(requested);
      };

      return h("nav", { className: "cnpc-pagination", "aria-label": `${t("page")} ${current}` },
        h("button", { type: "button", className: "cnpc-page-button", disabled: current <= 1, title: t("previousPage"), "aria-label": t("previousPage"), onClick: () => onPage(current - 1) }, "‹"),
        ...paginationTokens(current, total).map((token) => typeof token === "number"
          ? h("button", { key: token, type: "button", className: "cnpc-page-button", "aria-current": token === current ? "page" : undefined, onClick: () => onPage(token) }, String(token))
          : h("span", { key: token, className: "cnpc-page-ellipsis", "aria-hidden": "true" }, "...")),
        h("button", { type: "button", className: "cnpc-page-button", disabled: current >= total, title: t("nextPage"), "aria-label": t("nextPage"), onClick: () => onPage(current + 1) }, "›"),
        h("span", { className: "cnpc-page-status" }, `${t("page")} ${current} ${t("pageOf")} ${total} ${t("pages")}`),
        h("form", { className: "cnpc-jump", onSubmit: submit },
          h("input", { className: "cnpc-page-input", type: "number", min: 1, max: total, value: jump, placeholder: t("jumpPlaceholder"), "aria-label": t("jumpPlaceholder"), onChange: (event) => setJump(event.target.value) }),
          h("button", { type: "submit", className: "cnpc-button", disabled: !Number.isInteger(Number(jump)) || Number(jump) < 1 || Number(jump) > total }, t("jump"))
        )
      );
    }

    function PluginCenter({ t }) {
      const [view, setView] = React.useState({ status: "loading" });
      const [query, setQuery] = React.useState("");
      const [category, setCategory] = React.useState("all");
      const [presetId, setPresetId] = React.useState("npmmirror");
      const [registry, setRegistry] = React.useState("");
      const [proxyEnabled, setProxyEnabled] = React.useState(false);
      const [proxyUrl, setProxyUrl] = React.useState("");
      const [sourceBusy, setSourceBusy] = React.useState("");
      const [sourceResult, setSourceResult] = React.useState(null);
      const [busyId, setBusyId] = React.useState(null);
      const [operationLog, setOperationLog] = React.useState("");
      const [request, setRequest] = React.useState(0);
      const [expanded, setExpanded] = React.useState(false);
      const [onlinePage, setOnlinePage] = React.useState(1);
      const [onlineRequest, setOnlineRequest] = React.useState(0);
      const [online, setOnline] = React.useState({ status: "idle", results: [], page: 1, total: 0, totalPages: 0 });

      React.useEffect(() => {
        let current = true;
        setView((previous) => previous.status === "ready" ? previous : { status: "loading" });
        api("/state").then((raw) => {
          if (!current) return;
          const data = normalizeState(raw);
          setView({ status: "ready", data });
          setPresetId(data.source.presetId || "custom");
          setRegistry(data.source.registry || "");
          setProxyEnabled(Boolean(data.source.githubProxyEnabled));
          setProxyUrl(data.source.githubProxyUrl || "");
        }).catch((error) => {
          if (current) setView({ status: "error", message: error.message });
        });
        return () => { current = false; };
      }, [request]);

      const onlineMode = expanded || query.trim().length > 0;
      React.useEffect(() => {
        const trimmedQuery = query.trim();
        if (!expanded && trimmedQuery.length === 0) {
          setOnline({ status: "idle", results: [], page: 1, total: 0, totalPages: 0 });
          return () => {};
        }

        let current = true;
        const timer = setTimeout(() => {
          setOnline((previous) => ({ ...previous, status: "loading" }));
          api(`/plugins/search?q=${encodeURIComponent(trimmedQuery)}&page=${onlinePage}&pageSize=20`).then((result) => {
            if (!current) return;
            setOnline({
              status: "ready",
              results: Array.isArray(result.results) ? result.results : [],
              page: Number(result.page) || 1,
              total: Number(result.total) || 0,
              totalPages: Number(result.totalPages) || 0,
              sourceRegistry: result.sourceRegistry || ""
            });
          }).catch((error) => {
            if (current) setOnline((previous) => ({ ...previous, status: "error", message: error.message }));
          });
        }, trimmedQuery.length > 0 ? 400 : 0);
        return () => {
          current = false;
          clearTimeout(timer);
        };
      }, [expanded, query, onlinePage, onlineRequest, request]);

      const reload = () => setRequest((value) => value + 1);

      if (view.status === "loading") {
        return h("div", { className: "cnpc-root" }, h("div", { className: "cnpc-loading" }, t("loading")));
      }
      if (view.status === "error") {
        return h("div", { className: "cnpc-root" },
          h("div", { className: "cnpc-error" },
            h("span", null, `${t("loadFailed")}: ${view.message}`),
            h("button", { type: "button", className: "cnpc-button", onClick: reload }, t("retry"))
          )
        );
      }

      const data = view.data;
      const selectedMirror = data.mirrors.find((item) => item.id === presetId);
      const selectedRegistry = presetId === "custom" ? registry : selectedMirror && selectedMirror.url || registry;
      const localeIsZh = t("tab") === zh.tab;
      const categories = Array.from(new Set(data.plugins.map((item) => localeIsZh ? item.category : item.categoryEn || item.category))).sort();
      const normalizedQuery = query.trim().toLocaleLowerCase();
      const filtered = data.plugins.filter((plugin) => {
        const localizedCategory = localeIsZh ? plugin.category : plugin.categoryEn || plugin.category;
        const localizedDescription = localeIsZh ? plugin.description : plugin.descriptionEn || plugin.description;
        const matchesCategory = category === "all" || localizedCategory === category;
        const matchesQuery = !normalizedQuery || [plugin.name, plugin.id, localizedDescription].some((value) => String(value || "").toLocaleLowerCase().includes(normalizedQuery));
        return matchesCategory && matchesQuery;
      });
      const displayedPlugins = onlineMode ? online.results : filtered;
      const displayedCount = onlineMode ? online.total : filtered.length;
      const catalogTitle = onlineMode
        ? normalizedQuery ? t("searchResultsTitle") : t("catalogAllTitle")
        : t("catalogTitle");

      const showAll = () => {
        setExpanded(true);
        setCategory("all");
        setQuery("");
        setOnlinePage(1);
      };

      const showCurated = () => {
        setExpanded(false);
        setQuery("");
        setCategory("all");
        setOnlinePage(1);
      };

      const changeOnlinePage = (page) => {
        if (!Number.isInteger(page) || page < 1 || page > online.totalPages || page === online.page) return;
        setOnlinePage(page);
        setTimeout(() => document.getElementById("cnpc-catalog-heading")?.scrollIntoView({ block: "start", behavior: "smooth" }), 0);
      };

      const updateSourceState = (patch) => {
        setView((current) => current.status === "ready" ? { status: "ready", data: { ...current.data, source: { ...current.data.source, ...patch } } } : current);
      };

      const testSource = async () => {
        setSourceBusy("test");
        setSourceResult(null);
        try {
          const result = await api("/source/test", { method: "POST", body: JSON.stringify({ registry: selectedRegistry }) });
          setSourceResult({ kind: "success", ...(result.verification || result) });
        } catch (error) {
          setSourceResult({ kind: "error", message: error.message });
        } finally {
          setSourceBusy("");
        }
      };

      const saveSource = async () => {
        setSourceBusy("save");
        setSourceResult(null);
        try {
          const result = await api("/source/save", {
            method: "POST",
            body: JSON.stringify({ registry: selectedRegistry, githubProxyEnabled: proxyEnabled, githubProxyUrl: proxyUrl })
          });
          setSourceResult({ kind: "success", ...(result.verification || result) });
          updateSourceState({ registry: selectedRegistry, presetId, githubProxyEnabled: proxyEnabled, githubProxyUrl: proxyUrl });
          reload();
        } catch (error) {
          setSourceResult({ kind: "error", message: error.message });
        } finally {
          setSourceBusy("");
        }
      };

      const operate = async (plugin, action) => {
        const confirmKey = action === "remove" ? "removeConfirm" : action === "update" ? "updateConfirm" : "installConfirm";
        if (!window.confirm(`${plugin.name}\n\n${t(confirmKey)}`)) return;
        setBusyId(plugin.id);
        setOperationLog("");
        try {
          const operationVersion = action === "remove" && plugin.origin === "community" ? plugin.installedVersion || plugin.version : plugin.version;
          const result = await api("/plugins/operate", { method: "POST", body: JSON.stringify({ id: plugin.id, action, version: operationVersion, origin: plugin.origin || "curated" }) });
          setOperationLog(result.log || result.output || `${plugin.id}: ${action}`);
          setView((current) => current.status === "ready" ? { status: "ready", data: { ...current.data, restartRequired: true } } : current);
          reload();
        } catch (error) {
          const details = error.details && typeof error.details === "object" ? JSON.stringify(error.details, null, 2) : error.details;
          setOperationLog([error.message, details].filter(Boolean).join("\n\n"));
        } finally {
          setBusyId(null);
        }
      };

      return h("div", { className: "cnpc-root" },
        h("section", { className: "cnpc-source", "aria-labelledby": "cnpc-source-heading" },
          h("h3", { className: "cnpc-heading", id: "cnpc-source-heading" }, t("sourceTitle")),
          h("div", { className: "cnpc-source-grid" },
            h("label", { className: "cnpc-field" },
              h("span", null, t("source")),
              h("select", {
                className: "cnpc-select",
                value: presetId,
                disabled: Boolean(sourceBusy),
                onChange: (event) => {
                  const nextId = event.target.value;
                  setPresetId(nextId);
                  const mirror = data.mirrors.find((item) => item.id === nextId);
                  if (mirror) setRegistry(mirror.url);
                  setSourceResult(null);
                }
              },
                ...data.mirrors.map((mirror) => h("option", { key: mirror.id, value: mirror.id }, `${localeIsZh ? MIRROR_LABELS_ZH[mirror.id] || mirror.label : mirror.label}${mirror.recommended ? ` (${localeIsZh ? "推荐" : "Recommended"})` : ""}`)),
                h("option", { value: "custom" }, t("customSource"))
              )
            ),
            h("label", { className: "cnpc-field" },
              h("span", null, t("customSource")),
              h("input", {
                className: "cnpc-input",
                type: "url",
                value: selectedRegistry || "",
                disabled: Boolean(sourceBusy) || presetId !== "custom",
                onChange: (event) => { setRegistry(event.target.value); setSourceResult(null); },
                spellCheck: false
              })
            ),
            h("div", { className: "cnpc-actions" },
              h("button", { type: "button", className: "cnpc-button", disabled: Boolean(sourceBusy), onClick: testSource }, sourceBusy === "test" ? t("testing") : t("test")),
              h("button", { type: "button", className: "cnpc-button cnpc-primary", disabled: Boolean(sourceBusy), onClick: saveSource }, sourceBusy === "save" ? t("saving") : t("save"))
            )
          ),
          h("div", { className: "cnpc-proxy-row" },
            h("label", { className: "cnpc-check" },
              h("input", { type: "checkbox", checked: proxyEnabled, disabled: Boolean(sourceBusy), onChange: (event) => setProxyEnabled(event.target.checked) }),
              h("span", null, t("githubProxy"))
            ),
            h("label", { className: "cnpc-field" },
              h("span", null, t("githubProxyUrl")),
              h("input", { className: "cnpc-input", type: "url", value: proxyUrl, placeholder: t("proxyPlaceholder"), disabled: !proxyEnabled || Boolean(sourceBusy), onChange: (event) => setProxyUrl(event.target.value), spellCheck: false })
            )
          ),
          sourceResult ? h("div", { className: "cnpc-status", "data-kind": sourceResult.kind, role: "status" },
            h("strong", null, sourceResult.kind === "success" ? t("sourceReady") : t("sourceFailed")),
            sourceResult.latencyMs !== undefined ? h("span", null, `${t("latency")}: ${sourceResult.latencyMs} ms`) : null,
            sourceResult.integrityVerified || sourceResult.integrityMatch ? h("span", null, t("officialIntegrity")) : null,
            sourceResult.message ? h("span", null, sourceResult.message) : null
          ) : null
        ),
        data.restartRequired ? h("div", { className: "cnpc-restart", role: "status" }, t("restartRequired")) : null,
        h("section", { className: "cnpc-catalog", "aria-labelledby": "cnpc-catalog-heading" },
          h("div", { className: "cnpc-catalog-head" },
            h("div", { className: "cnpc-catalog-head-main" },
              h("h3", { className: "cnpc-heading", id: "cnpc-catalog-heading" }, catalogTitle),
              h("span", { className: "cnpc-count" }, `${displayedCount} ${t("count")}`)
            ),
            onlineMode ? h("div", { className: "cnpc-catalog-head-actions" },
              h("button", { type: "button", className: "cnpc-button", onClick: showCurated }, t("curatedOnly"))
            ) : null
          ),
          h("div", { className: "cnpc-filters", "data-wide": onlineMode ? "true" : "false" },
            h("label", { className: "cnpc-field" },
              h("span", null, t("search")),
              h("input", { className: "cnpc-input", type: "search", value: query, placeholder: t("searchPlaceholder"), onChange: (event) => { setQuery(event.target.value); setOnlinePage(1); } })
            ),
            !onlineMode ? h("label", { className: "cnpc-field" },
              h("span", null, t("category")),
              h("select", { className: "cnpc-select", value: category, onChange: (event) => setCategory(event.target.value) },
                h("option", { value: "all" }, t("allCategories")),
                ...categories.map((item) => h("option", { key: item, value: item }, item))
              )
            ) : null
          ),
          h("p", { className: "cnpc-notice" }, t("thirdPartyNotice")),
          onlineMode && (online.status === "idle" || online.status === "loading") && displayedPlugins.length === 0
            ? h("div", { className: "cnpc-loading", role: "status" }, t("loadingCommunity"))
            : onlineMode && online.status === "error"
              ? h("div", { className: "cnpc-error" },
                  h("span", null, `${t("communityFailed")}: ${online.message}`),
                  h("button", { type: "button", className: "cnpc-button", onClick: () => setOnlineRequest((value) => value + 1) }, t("retry"))
                )
              : displayedPlugins.length
                ? h("div", { className: "cnpc-grid" }, ...displayedPlugins.map((plugin) => h(PluginCard, { key: plugin.id, plugin, busyId: busyId || (data.busy ? "__external__" : null), t, onOperate: operate })))
                : h("div", { className: "cnpc-empty" }, t("empty")),
          onlineMode && online.status === "loading" && displayedPlugins.length > 0 ? h("div", { className: "cnpc-status", role: "status" }, t("loadingCommunity")) : null,
          !onlineMode ? h("div", { className: "cnpc-expand" },
            h("button", { type: "button", className: "cnpc-button cnpc-primary", onClick: showAll }, t("expandAll"))
          ) : null,
          onlineMode && online.status === "ready" ? h(Pagination, { current: online.page, total: online.totalPages, onPage: changeOnlinePage, t }) : null
        ),
        operationLog ? h("section", { className: "cnpc-log" },
          h("div", { className: "cnpc-log-head" },
            h("h3", { className: "cnpc-heading" }, t("operationLog")),
            h("button", { type: "button", className: "cnpc-button", onClick: () => setOperationLog("") }, t("closeLog"))
          ),
          h("pre", null, operationLog)
        ) : null
      );
    }

    const inject = ["slots", "locale"];
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "cn-plugin-center: dictionaries");
      const t = ctx.locale.bind(NS);
      ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
        name: "settings.plugins.tab",
        id: "cn-plugin-center",
        order: 20,
        label: () => t("tab"),
        locale: NS,
        inject: () => ({})
      }, PluginCenter));
    }

    exports.NS = NS;
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
