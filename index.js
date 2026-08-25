import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const inject = ["webServer"];

const API_PREFIX = "/cn-plugin-center/api";
const BODY_LIMIT = 64 * 1024;
const LOG_LIMIT = 64 * 1024;
const FETCH_LIMIT = 4 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12_000;
const COMMAND_TIMEOUT_MS = 10 * 60_000;
const SEARCH_CACHE_TTL_MS = 10 * 60_000;
const SEARCH_CONCURRENCY = 12;
const DEFAULT_SEARCH_PAGE_SIZE = 20;
const MAX_SEARCH_PAGE_SIZE = 20;
const SEARCH_FALLBACK_REGISTRY = "https://registry.npmmirror.com/";
const DSH_VERSION = "0.1.1-rc.2";
const DSH_INTEGRITY =
  "sha512-UP1UIh6q3Gme/yXRn/QL2P8IsVlv8Shpg22TRJIZPsCRWLm4CBiA1MUvXmJAfsOEETBMLAl+xWPtFw6ICsN3wg==";
const NPM_PACKAGE_RE = /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/;
const EXACT_VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

const PLUGIN_DIR = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(PLUGIN_DIR, "catalog.json");
const DSH_HOME = path.resolve(
  process.env.DSH_HOME || path.join(os.homedir(), ".dsh"),
);
const PROFILE_DIR = path.join(DSH_HOME, "profiles", "web");
const PROFILE_PACKAGE_PATH = path.join(PROFILE_DIR, "package.json");
const PROFILE_NPMRC_PATH = path.join(PROFILE_DIR, ".npmrc");
const SETTINGS_DIR = path.join(DSH_HOME, "cn-plugin-center");
const SETTINGS_PATH = path.join(SETTINGS_DIR, "settings.json");

const REGISTRY_PRESETS = Object.freeze([
  {
    id: "npmmirror",
    label: "npmmirror (China)",
    url: "https://registry.npmmirror.com/",
    recommended: true,
  },
  {
    id: "huawei",
    label: "Huawei Cloud",
    url: "https://mirrors.huaweicloud.com/repository/npm/",
    recommended: false,
  },
  {
    id: "tencent",
    label: "Tencent Cloud",
    url: "https://mirrors.tencent.com/npm/",
    recommended: false,
  },
  {
    id: "npmjs",
    label: "npmjs (Official)",
    url: "https://registry.npmjs.org/",
    recommended: false,
  },
]);

let mutationInProgress = null;
let restartRequired = false;
const searchCache = new Map();

class HttpError extends Error {
  constructor(status, message, details, code = `HTTP_${status}`) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isLoopbackAddress(address) {
  if (!address) return false;
  const value = String(address).toLowerCase().split("%")[0];
  if (value === "::1" || value === "127.0.0.1") return true;
  if (value.startsWith("::ffff:")) {
    return isLoopbackAddress(value.slice("::ffff:".length));
  }
  const parts = value.split(".");
  return (
    parts.length === 4 &&
    parts[0] === "127" &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  );
}

function isLoopbackHostname(hostname) {
  const value = String(hostname || "")
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split("%")[0];
  return value === "localhost" || isLoopbackAddress(value);
}

function assertLocalRequest(req) {
  if (!isLoopbackAddress(req.socket?.remoteAddress)) {
    throw new HttpError(403, "This API is available only from the local machine.");
  }
}

function requestOrigin(req) {
  const host = req.headers.host;
  if (typeof host !== "string" || host.length > 255) {
    throw new HttpError(400, "A valid Host header is required.");
  }

  let expected;
  try {
    expected = new URL(`http://${host}`);
  } catch {
    throw new HttpError(400, "The Host header is invalid.");
  }
  if (!isLoopbackHostname(expected.hostname)) {
    throw new HttpError(403, "The Host header must point to loopback.");
  }
  return expected.origin;
}

function assertWriteRequest(req) {
  if (req.headers["x-dsh-cn-plugin-center"] !== "1") {
    throw new HttpError(403, "The plugin-center request header is required.");
  }

  const expectedOrigin = requestOrigin(req);
  const origin = req.headers.origin;
  if (origin !== undefined) {
    let normalizedOrigin;
    try {
      normalizedOrigin = new URL(String(origin)).origin;
    } catch {
      throw new HttpError(403, "The request Origin is invalid.");
    }
    if (normalizedOrigin !== expectedOrigin) {
      throw new HttpError(403, "Cross-origin writes are not allowed.");
    }
  }

  const fetchSite = req.headers["sec-fetch-site"];
  if (fetchSite !== undefined && fetchSite !== "same-origin") {
    throw new HttpError(403, "Cross-site writes are not allowed.");
  }
}

function sendJson(res, status, payload) {
  if (res.headersSent || res.writableEnded) return;
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

async function readJsonBody(req) {
  const contentType = String(req.headers["content-type"] || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new HttpError(415, "Content-Type must be application/json.");
  }

  const declaredLength = Number(req.headers["content-length"] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > BODY_LIMIT) {
    throw new HttpError(413, "The request body is too large.");
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > BODY_LIMIT) {
      throw new HttpError(413, "The request body is too large.");
    }
    chunks.push(buffer);
  }

  if (size === 0) return {};
  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
  } catch {
    throw new HttpError(400, "The request body is not valid JSON.");
  }
  if (!isObject(parsed)) {
    throw new HttpError(400, "The request body must be a JSON object.");
  }
  return parsed;
}

async function readJsonFile(filePath, fallback = null) {
  try {
    const text = await readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch (error) {
    if (error && error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function readCatalog() {
  const catalog = await readJsonFile(CATALOG_PATH);
  if (!isObject(catalog) || !Array.isArray(catalog.plugins)) {
    throw new HttpError(500, "The plugin catalog is missing or invalid.");
  }

  const seen = new Set();
  const plugins = catalog.plugins.map((plugin) => {
    if (
      !isObject(plugin) ||
      typeof plugin.id !== "string" ||
      !NPM_PACKAGE_RE.test(plugin.id) ||
      typeof plugin.version !== "string" ||
      !EXACT_VERSION_RE.test(plugin.version) ||
      seen.has(plugin.id)
    ) {
      throw new HttpError(500, "The plugin catalog contains an invalid entry.");
    }
    seen.add(plugin.id);
    return plugin;
  });

  return { ...catalog, plugins };
}

function normalizeRegistry(value) {
  if (typeof value !== "string" || value.length > 2048) {
    throw new HttpError(400, "A registry URL is required.");
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new HttpError(400, "The registry URL is invalid.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.hostname
  ) {
    throw new HttpError(
      400,
      "A custom registry must use HTTPS without credentials, a query, or a fragment.",
    );
  }
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}

function registryFromBody(body) {
  const presetId = body.sourceId || body.presetId;
  if (presetId !== undefined) {
    const preset = REGISTRY_PRESETS.find((entry) => entry.id === presetId);
    if (!preset) throw new HttpError(400, "The selected registry preset is unknown.");
    return preset.url;
  }
  return normalizeRegistry(body.registry || body.url);
}

function normalizeProxy(value) {
  if (typeof value !== "string" || value.length > 2048) {
    throw new HttpError(400, "A local GitHub proxy URL is required.");
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new HttpError(400, "The local GitHub proxy URL is invalid.");
  }
  if (
    !["http:", "https:", "socks5:", "socks5h:"].includes(url.protocol) ||
    !isLoopbackHostname(url.hostname) ||
    !url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname && url.pathname !== "/")
  ) {
    throw new HttpError(
      400,
      "The GitHub proxy must be a credential-free loopback proxy URL with an explicit port.",
    );
  }
  return url.href.replace(/\/$/, "");
}

function proxySettingsFromBody(body) {
  const nested = isObject(body.githubProxy) ? body.githubProxy : null;
  const enabled = Boolean(
    nested ? nested.enabled : body.githubProxyEnabled ?? body.proxyEnabled,
  );
  const rawUrl = nested ? nested.url : body.githubProxyUrl ?? body.proxyUrl;
  return {
    githubProxyEnabled: enabled,
    githubProxyUrl: enabled ? normalizeProxy(rawUrl) : "",
  };
}

async function readSettings() {
  const settings = await readJsonFile(SETTINGS_PATH, {});
  if (!isObject(settings) || settings.githubProxyEnabled !== true) {
    return { githubProxyEnabled: false, githubProxyUrl: "" };
  }
  try {
    return {
      githubProxyEnabled: true,
      githubProxyUrl: normalizeProxy(settings.githubProxyUrl),
    };
  } catch {
    return { githubProxyEnabled: false, githubProxyUrl: "" };
  }
}

async function writeSettings(settings) {
  await mkdir(SETTINGS_DIR, { recursive: true });
  const temporaryPath = `${SETTINGS_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, SETTINGS_PATH);
}

async function currentRegistry() {
  let value = REGISTRY_PRESETS.find((entry) => entry.id === "npmjs").url;
  try {
    const npmrc = await readFile(PROFILE_NPMRC_PATH, "utf8");
    for (const line of npmrc.split(/\r?\n/)) {
      const match = line.match(/^\s*registry\s*=\s*(.*?)\s*$/i);
      if (match && match[1]) value = match[1].replace(/^(?:"|')|(?:"|')$/g, "");
    }
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
  }

  try {
    return normalizeRegistry(value);
  } catch {
    return value;
  }
}

function packageDirectory(packageName) {
  return path.join(PROFILE_DIR, "node_modules", ...packageName.split("/"));
}

function bundleIsActive(bundles, packageName) {
  return bundles.some(
    (entry) =>
      entry === packageName ||
      (isObject(entry) && (entry.name === packageName || entry.package === packageName)),
  );
}

function compareSemver(leftValue, rightValue) {
  const parse = (value) => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
      String(value || ""),
    );
    if (!match) return null;
    return {
      core: [Number(match[1]), Number(match[2]), Number(match[3])],
      prerelease: match[4] === undefined ? null : match[4].split("."),
    };
  };
  const left = parse(leftValue);
  const right = parse(rightValue);
  if (!left || !right) return null;

  for (let index = 0; index < left.core.length; index += 1) {
    if (left.core[index] !== right.core[index]) {
      return left.core[index] < right.core[index] ? -1 : 1;
    }
  }
  if (left.prerelease === null || right.prerelease === null) {
    if (left.prerelease === right.prerelease) return 0;
    return left.prerelease === null ? 1 : -1;
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined || rightPart === undefined) {
      if (leftPart === rightPart) return 0;
      return leftPart === undefined ? -1 : 1;
    }
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) return Number(leftPart) < Number(rightPart) ? -1 : 1;
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

function isProtectedCommunityPackage(packageName) {
  return packageName === "dsh-cn-plugin-center" || packageName.startsWith("@deepseek-ai/");
}

function packageLeafName(packageName) {
  const segments = String(packageName || "").split("/");
  return segments[segments.length - 1] || "";
}

function packageKeywords(value) {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => typeof entry === "string")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\s,]+/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function isCommunityCandidate(packageName, keywords) {
  if (
    typeof packageName !== "string" ||
    !NPM_PACKAGE_RE.test(packageName) ||
    isProtectedCommunityPackage(packageName)
  ) {
    return false;
  }
  if (packageLeafName(packageName).startsWith("dsh-")) return true;
  const keywordSet = new Set(packageKeywords(keywords));
  return ["dsh-plugin", "deepseek-harness-plugin", "deepseek-harness"].some((keyword) =>
    keywordSet.has(keyword),
  );
}

function verifiedBundlePatch(manifest) {
  const patch = manifest?.dsh?.bundle?.patch;
  if (
    typeof patch !== "string" ||
    patch.length === 0 ||
    patch.length > 512 ||
    patch !== patch.trim() ||
    patch.startsWith("/") ||
    patch.startsWith("\\") ||
    patch.includes("..") ||
    path.posix.isAbsolute(patch) ||
    path.win32.isAbsolute(patch)
  ) {
    return null;
  }
  return patch;
}

function verifyCommunityManifest(manifest, expectedName, expectedVersion = null) {
  if (
    !isObject(manifest) ||
    manifest.name !== expectedName ||
    !NPM_PACKAGE_RE.test(expectedName) ||
    isProtectedCommunityPackage(expectedName) ||
    typeof manifest.version !== "string" ||
    !EXACT_VERSION_RE.test(manifest.version) ||
    (expectedVersion !== null && manifest.version !== expectedVersion) ||
    !isCommunityCandidate(expectedName, manifest.keywords)
  ) {
    return null;
  }
  const patch = verifiedBundlePatch(manifest);
  const integrity = manifest?.dist?.integrity || manifest?.dist?.shasum;
  if (
    patch === null ||
    typeof integrity !== "string" ||
    integrity.length === 0 ||
    integrity.length > 1024
  ) {
    return null;
  }
  return { patch, integrity };
}

function cleanRegistryText(value, limit = 500) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, limit);
}

function npmPackagePage(packageName) {
  const packagePath = packageName.split("/").map(encodeURIComponent).join("/");
  return `https://www.npmjs.com/package/${packagePath}`;
}

function safeRepositoryUrl(manifest) {
  const repository = manifest?.repository;
  let value = typeof repository === "string" ? repository : repository?.url;
  if (typeof value !== "string") return npmPackagePage(manifest.name);
  value = value.trim().replace(/^git\+/, "");
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return npmPackagePage(manifest.name);
    }
    return url.href;
  } catch {
    return npmPackagePage(manifest.name);
  }
}

function publisherName(manifest, searchPackage) {
  const publisher = manifest?._npmUser || manifest?.publisher || searchPackage?.publisher;
  if (typeof publisher === "string") return cleanRegistryText(publisher, 120);
  if (!isObject(publisher)) return "";
  return cleanRegistryText(publisher.username || publisher.name || "", 120);
}

function searchObjectScore(searchObject) {
  const values = [
    searchObject?.searchScore,
    searchObject?.score?.final,
    searchObject?.downloads?.all,
    searchObject?.downloads?.monthly,
    searchObject?.downloads?.weekly,
  ];
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function encodedRegistryPackageName(packageName) {
  return encodeURIComponent(packageName).replace(/^%40/i, "@");
}

function registryPackageUrl(registry, packageName, version = null) {
  const suffix = version === null ? "" : `/${encodeURIComponent(version)}`;
  return new URL(`${encodedRegistryPackageName(packageName)}${suffix}`, registry).href;
}

async function fetchJsonWithTimeout(url, limit = FETCH_LIMIT) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetchCheckedJson(url, controller.signal, limit);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSearchObjects(registry, text, size) {
  const url = new URL("-/v1/search", registry);
  url.searchParams.set("text", text);
  url.searchParams.set("size", String(size));
  url.searchParams.set("from", "0");
  const payload = await fetchJsonWithTimeout(url.href);
  if (!isObject(payload) || !Array.isArray(payload.objects)) {
    throw new Error("The registry does not expose a compatible npm search endpoint.");
  }
  if (
    payload.objects.length > 0 &&
    !payload.objects.some((entry) => isObject(entry) && isObject(entry.package))
  ) {
    throw new Error("The registry returned invalid npm search objects.");
  }
  return payload.objects;
}

async function discoverCommunityCandidates(registryValue, query) {
  const registry = normalizeRegistry(registryValue);
  const searches = query
    ? [
        { text: `${query} dsh`, size: 150 },
        { text: `${query} deepseek harness`, size: 150 },
      ]
    : [
        { text: "dsh-", size: 250 },
        { text: "deepseek harness plugin", size: 250 },
        { text: "dsh plugin", size: 250 },
      ];

  const runSearches = async (sourceRegistry) =>
    Promise.all(
      searches.map((search) => fetchSearchObjects(sourceRegistry, search.text, search.size)),
    );

  let sourceRegistry = registry;
  let batches;
  try {
    batches = await runSearches(sourceRegistry);
  } catch (primaryError) {
    if (sourceRegistry === SEARCH_FALLBACK_REGISTRY) {
      throw new HttpError(
        502,
        primaryError instanceof Error ? primaryError.message : String(primaryError),
      );
    }
    sourceRegistry = SEARCH_FALLBACK_REGISTRY;
    try {
      batches = await runSearches(sourceRegistry);
    } catch (fallbackError) {
      throw new HttpError(
        502,
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      );
    }
  }

  const candidates = new Map();
  for (const searchObject of batches.flat()) {
    const searchPackage = isObject(searchObject) ? searchObject.package : null;
    const packageName = searchPackage?.name;
    if (!isCommunityCandidate(packageName, searchPackage?.keywords)) continue;
    const score = searchObjectScore(searchObject);
    const previous = candidates.get(packageName);
    if (!previous || score > previous.score) {
      candidates.set(packageName, { packageName, score, searchPackage });
    }
  }
  return { sourceRegistry, candidates: [...candidates.values()] };
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(values.length, 1)) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(values[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function communityPluginView(manifest, candidate, verification) {
  const description = cleanRegistryText(manifest.description, 800);
  return {
    id: manifest.name,
    name: cleanRegistryText(manifest.displayName, 160) || manifest.name,
    version: manifest.version,
    category: "社区",
    categoryEn: "Community",
    description,
    descriptionEn: description,
    repository: safeRepositoryUrl(manifest),
    compatibility: {
      level: "review",
      label: "结构已验证",
      labelEn: "Structure verified",
      note: "已验证 dsh.bundle 插件结构；这不是与当前 Harness 版本兼容的认证。",
      noteEn: "The dsh.bundle structure was verified; this is not a compatibility certification for the current Harness version.",
    },
    featured: false,
    origin: "community",
    verified: true,
    bundlePatch: verification.patch,
    publisher: publisherName(manifest, candidate.searchPackage),
    score: candidate.score,
  };
}

async function buildCommunityCatalog(registry, query) {
  const discovery = await discoverCommunityCandidates(registry, query);
  const verified = await mapWithConcurrency(
    discovery.candidates,
    SEARCH_CONCURRENCY,
    async (candidate) => {
      try {
        const metadata = await fetchJsonWithTimeout(
          registryPackageUrl(discovery.sourceRegistry, candidate.packageName),
        );
        if (!isObject(metadata) || metadata.name !== candidate.packageName) return null;
        const latestVersion = metadata?.["dist-tags"]?.latest;
        if (typeof latestVersion !== "string" || !EXACT_VERSION_RE.test(latestVersion)) {
          return null;
        }
        const manifest = metadata?.versions?.[latestVersion];
        const verification = verifyCommunityManifest(
          manifest,
          candidate.packageName,
          latestVersion,
        );
        if (verification === null) return null;
        return communityPluginView(manifest, candidate, verification);
      } catch {
        return null;
      }
    },
  );
  return {
    sourceRegistry: discovery.sourceRegistry,
    plugins: verified.filter(Boolean),
  };
}

function pruneSearchCache() {
  const now = Date.now();
  for (const [key, entry] of searchCache) {
    if (entry.expiresAt <= now) searchCache.delete(key);
  }
  while (searchCache.size >= 100) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey === undefined) break;
    searchCache.delete(oldestKey);
  }
}

async function cachedCommunityCatalog(registry, query) {
  const key = `${registry}\u0000${query}`;
  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  pruneSearchCache();
  const promise = buildCommunityCatalog(registry, query);
  searchCache.set(key, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, promise });
  try {
    const result = await promise;
    searchCache.set(key, {
      expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
      promise: Promise.resolve(result),
    });
    return result;
  } catch (error) {
    searchCache.delete(key);
    throw error;
  }
}

function catalogPluginMatches(plugin, query) {
  if (!query) return true;
  const haystack = [
    plugin.id,
    plugin.name,
    plugin.description,
    plugin.descriptionEn,
    plugin.category,
    plugin.categoryEn,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join("\n");
  return haystack.includes(query.toLowerCase());
}

async function readProfileInstallData() {
  const profilePackage = await readJsonFile(PROFILE_PACKAGE_PATH, {});
  const dependencies = {
    ...(isObject(profilePackage?.dependencies) ? profilePackage.dependencies : {}),
    ...(isObject(profilePackage?.optionalDependencies)
      ? profilePackage.optionalDependencies
      : {}),
    ...(isObject(profilePackage?.devDependencies) ? profilePackage.devDependencies : {}),
  };
  const bundles = Array.isArray(profilePackage?.dsh?.profile?.bundles)
    ? profilePackage.dsh.profile.bundles
    : [];
  return { dependencies, bundles };
}

async function enrichPluginEntries(plugins, installData = null) {
  const profile = installData || (await readProfileInstallData());
  return Promise.all(
    plugins.map(async (plugin) => {
      const installedPackage = await readJsonFile(
        path.join(packageDirectory(plugin.id), "package.json"),
        null,
      );
      const installedVersion =
        isObject(installedPackage) && typeof installedPackage.version === "string"
          ? installedPackage.version
          : null;
      const dependencySpec =
        typeof profile.dependencies[plugin.id] === "string"
          ? profile.dependencies[plugin.id]
          : null;
      const installed = dependencySpec !== null || installedVersion !== null;
      return {
        ...plugin,
        installed,
        installedVersion,
        dependencySpec,
        active: installed && bundleIsActive(profile.bundles, plugin.id),
        updateAvailable:
          installedVersion !== null && compareSemver(installedVersion, plugin.version) === -1,
      };
    }),
  );
}

function searchResultComparator(left, right) {
  const leftCurated = left.origin === "curated";
  const rightCurated = right.origin === "curated";
  if (leftCurated !== rightCurated) return leftCurated ? -1 : 1;
  const scoreDifference = Number(right.score || 0) - Number(left.score || 0);
  if (scoreDifference !== 0) return scoreDifference;
  return String(left.name || left.id).localeCompare(String(right.name || right.id), "en");
}

async function searchPlugins(query, page, pageSize) {
  const [catalog, registry] = await Promise.all([readCatalog(), currentRegistry()]);
  const community = await cachedCommunityCatalog(registry, query);
  const curated = catalog.plugins
    .filter((plugin) => catalogPluginMatches(plugin, query))
    .map((plugin) => ({
      ...plugin,
      origin: "curated",
      verified: true,
      score: plugin.featured ? 1 : 0,
    }));
  const curatedIds = new Set(curated.map((plugin) => plugin.id));
  const merged = [
    ...curated,
    ...community.plugins.filter((plugin) => !curatedIds.has(plugin.id)),
  ].sort(searchResultComparator);

  const total = merged.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const effectivePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const start = (effectivePage - 1) * pageSize;
  const results = await enrichPluginEntries(merged.slice(start, start + pageSize));
  return {
    query,
    page: effectivePage,
    pageSize,
    total,
    totalPages,
    results,
    sourceRegistry: community.sourceRegistry,
  };
}

function positiveIntegerParameter(value, fallback, name, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) {
    throw new HttpError(400, `${name} must be a positive integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new HttpError(400, `${name} is outside the supported range.`);
  }
  return parsed;
}

function searchParameters(url) {
  const query = String(url.searchParams.get("q") || "").trim();
  if (query.length > 100) throw new HttpError(400, "The search query is too long.");
  const pageSize = positiveIntegerParameter(
    url.searchParams.get("pageSize"),
    DEFAULT_SEARCH_PAGE_SIZE,
    "pageSize",
    MAX_SEARCH_PAGE_SIZE,
  );
  if (pageSize !== DEFAULT_SEARCH_PAGE_SIZE) {
    throw new HttpError(400, "pageSize must be 20.");
  }
  return {
    query,
    page: positiveIntegerParameter(url.searchParams.get("page"), 1, "page", 100_000),
    pageSize,
  };
}

async function buildState() {
  const [catalog, installData, settings, registry] = await Promise.all([
    readCatalog(),
    readProfileInstallData(),
    readSettings(),
    currentRegistry(),
  ]);
  const plugins = await enrichPluginEntries(catalog.plugins, installData);

  const selectedPreset = REGISTRY_PRESETS.find(
    (entry) => entry.url.toLowerCase() === String(registry).toLowerCase(),
  );
  return {
    catalogUpdatedAt: catalog.updatedAt ?? null,
    catalogSchemaVersion: catalog.schemaVersion ?? null,
    plugins,
    mirrors: REGISTRY_PRESETS,
    source: {
      registry,
      presetId: selectedPreset?.id || "custom",
      githubProxyEnabled: settings.githubProxyEnabled,
      githubProxyUrl: settings.githubProxyUrl,
    },
    busy: mutationInProgress !== null,
    busyOperation: mutationInProgress,
    restartRequired,
    profile: "web",
    dshVersion: DSH_VERSION,
  };
}

async function limitedText(response, limit) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new Error("The registry response is too large.");
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of response.body || []) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new Error("The registry response is too large.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, size).toString("utf8");
}

async function fetchCheckedJson(url, signal, limit) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": `dsh-cn-plugin-center/${DSH_VERSION}`,
    },
    redirect: "manual",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Registry request failed with HTTP ${response.status}.`);
  }
  const text = await limitedText(response, limit);
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw new Error("The registry returned invalid JSON.");
  }
}

async function testRegistry(registryValue) {
  const registry = normalizeRegistry(registryValue);
  const pingUrl = new URL("-/ping", registry).href;
  const metadataUrl = new URL("@deepseek-ai%2Fdsh", registry).href;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const [, metadata] = await Promise.all([
      fetchCheckedJson(pingUrl, controller.signal, 64 * 1024),
      fetchCheckedJson(metadataUrl, controller.signal, FETCH_LIMIT),
    ]);
    const integrity = metadata?.versions?.[DSH_VERSION]?.dist?.integrity;
    if (integrity !== DSH_INTEGRITY) {
      throw new Error(
        `Registry integrity verification failed for @deepseek-ai/dsh@${DSH_VERSION}.`,
      );
    }
    return {
      registry,
      latencyMs: Date.now() - startedAt,
      latestVersion: metadata?.["dist-tags"]?.latest || null,
      verifiedVersion: DSH_VERSION,
      integrityVerified: true,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new HttpError(504, "The registry test timed out.");
    }
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timeout);
  }
}

function dshBinCandidates() {
  const candidates = [];
  if (process.argv[1]) candidates.push(path.resolve(process.argv[1]));
  candidates.push(
    path.resolve(
      PLUGIN_DIR,
      "..",
      "..",
      "node_modules",
      "@deepseek-ai",
      "dsh",
      "lib",
      "bin.js",
    ),
    path.join(
      PROFILE_DIR,
      "node_modules",
      "@deepseek-ai",
      "dsh",
      "lib",
      "bin.js",
    ),
  );
  return [...new Set(candidates)];
}

function findDshBin() {
  const candidate = dshBinCandidates().find(
    (filePath) => path.basename(filePath).toLowerCase() === "bin.js" && existsSync(filePath),
  );
  if (!candidate) {
    throw new HttpError(500, "The DeepSeek Harness command entry could not be found.");
  }
  return candidate;
}

function appendGitProxyEnvironment(environment, proxyUrl) {
  const env = { ...environment };
  if (!proxyUrl) return env;
  const rawCount = Number.parseInt(env.GIT_CONFIG_COUNT || "0", 10);
  const count = Number.isInteger(rawCount) && rawCount >= 0 && rawCount < 100 ? rawCount : 0;
  env.GIT_CONFIG_COUNT = String(count + 1);
  env[`GIT_CONFIG_KEY_${count}`] = "http.https://github.com.proxy";
  env[`GIT_CONFIG_VALUE_${count}`] = proxyUrl;
  return env;
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
}

async function runDsh(argumentsList, options = {}) {
  await mkdir(PROFILE_DIR, { recursive: true });
  const dshBin = findDshBin();
  const environment = appendGitProxyEnvironment(
    { ...process.env, DSH_HOME },
    options.githubProxyUrl || "",
  );

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [dshBin, ...argumentsList], {
      cwd: PROFILE_DIR,
      env: environment,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let outputSize = 0;
    let truncated = false;
    let timedOut = false;

    const collect = (chunk) => {
      if (outputSize >= LOG_LIMIT) {
        truncated = true;
        return;
      }
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const remaining = LOG_LIMIT - outputSize;
      output += buffer.subarray(0, remaining).toString("utf8");
      outputSize += Math.min(buffer.length, remaining);
      if (buffer.length > remaining) truncated = true;
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, COMMAND_TIMEOUT_MS);

    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(new HttpError(500, `Unable to start DeepSeek Harness: ${error.message}`));
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      const cleanOutput = stripAnsi(output).trim();
      const log = `${cleanOutput}${truncated ? "\n[output truncated]" : ""}`.trim();
      if (timedOut) {
        reject(new HttpError(504, "The plugin operation timed out.", { log }));
        return;
      }
      if (code !== 0) {
        reject(
          new HttpError(502, `DeepSeek Harness exited with code ${code ?? signal}.`, {
            log,
          }),
        );
        return;
      }
      resolve({ log });
    });
  });
}

function acquireMutation(kind, pluginId = null) {
  if (mutationInProgress !== null) {
    throw new HttpError(409, "Another plugin-center operation is already running.", {
      operation: mutationInProgress,
    });
  }
  mutationInProgress = { kind, pluginId, startedAt: new Date().toISOString() };
  return () => {
    mutationInProgress = null;
  };
}

async function saveSource(body) {
  const registry = registryFromBody(body);
  const proxySettings = proxySettingsFromBody(body);
  const verification = await testRegistry(registry);
  const release = acquireMutation("source-save");
  try {
    const command = await runDsh([
      "plugin",
      "--profile",
      "web",
      "config",
      "set",
      "registry",
      registry,
      "--location=project",
    ]);
    await writeSettings(proxySettings);
    return {
      verification,
      githubProxy: {
        enabled: proxySettings.githubProxyEnabled,
        url: proxySettings.githubProxyUrl,
      },
      log: command.log,
    };
  } finally {
    release();
  }
}

async function fetchExactCommunityPlugin(registryValue, packageName, version) {
  const registry = normalizeRegistry(registryValue);
  let manifest;
  try {
    manifest = await fetchJsonWithTimeout(
      registryPackageUrl(registry, packageName, version),
    );
  } catch (error) {
    throw new HttpError(
      502,
      `Unable to verify ${packageName}@${version} from the current registry: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const verification = verifyCommunityManifest(manifest, packageName, version);
  if (verification === null) {
    throw new HttpError(
      422,
      "The requested package version is not a verified DeepSeek Harness bundle.",
    );
  }
  return { manifest, verification, registry };
}

async function installedPluginRecord(packageName) {
  const installData = await readProfileInstallData();
  const manifest = await readJsonFile(
    path.join(packageDirectory(packageName), "package.json"),
    null,
  );
  const dependencySpec =
    typeof installData.dependencies[packageName] === "string"
      ? installData.dependencies[packageName]
      : null;
  const installedVersion =
    isObject(manifest) && typeof manifest.version === "string" ? manifest.version : null;
  return {
    installData,
    manifest,
    dependencySpec,
    installedVersion,
    installed: dependencySpec !== null || installedVersion !== null,
  };
}

async function inspectInstalledBundle(packageName, expectedVersion = null) {
  const record = await installedPluginRecord(packageName);
  if (!record.installed || record.dependencySpec === null) {
    return { valid: false, reason: "The package is not a direct profile dependency.", record };
  }
  if (
    !isObject(record.manifest) ||
    record.manifest.name !== packageName ||
    !EXACT_VERSION_RE.test(String(record.manifest.version || "")) ||
    (expectedVersion !== null && record.manifest.version !== expectedVersion)
  ) {
    return { valid: false, reason: "The installed package manifest is invalid.", record };
  }
  const patch = verifiedBundlePatch(record.manifest);
  if (patch === null) {
    return { valid: false, reason: "The installed package has no safe dsh.bundle.patch.", record };
  }
  const packageRoot = path.resolve(packageDirectory(packageName));
  const patchPath = path.resolve(packageRoot, patch);
  const relativePatchPath = path.relative(packageRoot, patchPath);
  if (
    relativePatchPath === "" ||
    relativePatchPath.startsWith("..") ||
    path.isAbsolute(relativePatchPath)
  ) {
    return { valid: false, reason: "The installed bundle patch leaves the package directory.", record };
  }
  try {
    const patchStat = await stat(patchPath);
    if (!patchStat.isFile()) {
      return { valid: false, reason: "The installed bundle patch is not a file.", record };
    }
  } catch {
    return { valid: false, reason: "The installed bundle patch file is missing.", record };
  }
  return { valid: true, patch, patchPath, record };
}

async function operatePlugin(body) {
  const id = body.id;
  const action = body.action;
  if (
    typeof id !== "string" ||
    !NPM_PACKAGE_RE.test(id) ||
    !["install", "update", "remove"].includes(action)
  ) {
    throw new HttpError(400, "A plugin package name and a valid action are required.");
  }
  if (isProtectedCommunityPackage(id)) {
    throw new HttpError(403, "This package is protected from plugin-center changes.");
  }

  const catalog = await readCatalog();
  const curatedPlugin = catalog.plugins.find((entry) => entry.id === id) || null;
  const isCommunity = curatedPlugin === null;
  let targetVersion = curatedPlugin?.version || null;
  if (isCommunity) {
    if (typeof body.version !== "string" || !EXACT_VERSION_RE.test(body.version)) {
      throw new HttpError(400, "Community plugin operations require an exact version.");
    }
    targetVersion = body.version;
  }

  const release = acquireMutation(action, id);
  try {
    const [current, settings, registry] = await Promise.all([
      installedPluginRecord(id),
      readSettings(),
      currentRegistry(),
    ]);
    if (action === "install" && current.installed) {
      throw new HttpError(409, "The plugin is already installed.");
    }
    if ((action === "update" || action === "remove") && !current.installed) {
      throw new HttpError(409, "The plugin is not installed.");
    }

    if (isCommunity) {
      await fetchExactCommunityPlugin(registry, id, targetVersion);
    }
    if (action === "update") {
      if (
        current.installedVersion === null ||
        compareSemver(current.installedVersion, targetVersion) !== -1
      ) {
        throw new HttpError(409, "Updates must use a version newer than the installed one.");
      }
    }
    if (action === "remove") {
      if (isCommunity && current.installedVersion !== targetVersion) {
        throw new HttpError(409, "The requested version is not the installed version.");
      }
      const localBundle = await inspectInstalledBundle(
        id,
        isCommunity ? targetVersion : null,
      );
      if (!localBundle.valid) {
        throw new HttpError(422, localBundle.reason);
      }
    }

    const argumentsList =
      action === "remove"
        ? ["plugin", "--profile", "web", "remove", id]
        : [
            "plugin",
            "--profile",
            "web",
            "add",
            `${id}@${targetVersion}`,
            "--save-exact",
          ];
    const command = await runDsh(argumentsList, {
      githubProxyUrl: settings.githubProxyEnabled ? settings.githubProxyUrl : "",
    });

    if (action !== "remove") {
      const installedBundle = await inspectInstalledBundle(id, targetVersion);
      if (!installedBundle.valid) {
        let rollbackLog = "";
        let rollbackError = null;
        try {
          const rollback = await runDsh([
            "plugin",
            "--profile",
            "web",
            "remove",
            id,
          ]);
          rollbackLog = rollback.log;
          restartRequired = true;
        } catch (error) {
          rollbackError = error;
        }
        throw new HttpError(
          502,
          rollbackError
            ? "The installed bundle failed local validation and automatic rollback also failed."
            : "The installed bundle failed local validation and was removed automatically.",
          {
            reason: installedBundle.reason,
            installLog: command.log,
            rollbackLog,
            ...(rollbackError
              ? {
                  rollbackError:
                    rollbackError instanceof Error
                      ? rollbackError.message
                      : String(rollbackError),
                }
              : {}),
          },
        );
      }
    }

    restartRequired = true;
    const installedAfter = await installedPluginRecord(id);
    return {
      action,
      pluginId: id,
      installedVersion: installedAfter.installedVersion,
      restartRequired: true,
      log: command.log,
    };
  } finally {
    release();
  }
}

async function routeRequest(req, res) {
  assertLocalRequest(req);
  const url = new URL(req.url || "/", "http://loopback.invalid");
  const endpoint = url.pathname.slice(API_PREFIX.length) || "/";

  if (req.method === "GET" && endpoint === "/state") {
    sendJson(res, 200, { ok: true, data: await buildState() });
    return;
  }
  if (req.method === "GET" && endpoint === "/plugins/search") {
    const parameters = searchParameters(url);
    sendJson(res, 200, {
      ok: true,
      data: await searchPlugins(
        parameters.query,
        parameters.page,
        parameters.pageSize,
      ),
    });
    return;
  }

  if (req.method === "POST") {
    assertWriteRequest(req);
    const body = await readJsonBody(req);
    if (endpoint === "/source/test") {
      const verification = await testRegistry(registryFromBody(body));
      sendJson(res, 200, { ok: true, data: verification });
      return;
    }
    if (endpoint === "/source/save") {
      const result = await saveSource(body);
      sendJson(res, 200, { ok: true, data: result });
      return;
    }
    if (endpoint === "/plugins/operate") {
      const result = await operatePlugin(body);
      sendJson(res, 200, { ok: true, data: result });
      return;
    }
  }

  throw new HttpError(404, "Plugin-center API endpoint not found.");
}

export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "prefix",
        path: API_PREFIX,
        handler: async (req, res) => {
          try {
            await routeRequest(req, res);
          } catch (error) {
            const status = error instanceof HttpError ? error.status : 500;
            const message =
              error instanceof Error ? error.message : "An unexpected error occurred.";
            sendJson(res, status, {
              ok: false,
              error: {
                code: error instanceof HttpError ? error.code : "INTERNAL_ERROR",
                message,
                ...(error instanceof HttpError && error.details !== undefined
                  ? { details: error.details }
                  : {}),
              },
            });
          }
        },
      }),
    "register the China-friendly plugin-center API",
  );
}
