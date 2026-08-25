import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const temporaryHome = await mkdtemp(path.join(os.tmpdir(), "dsh-cn-plugin-center-"));
process.env.DSH_HOME = temporaryHome;
const originalFetch = globalThis.fetch;

function responseRecorder() {
  return {
    status: null,
    headers: null,
    body: "",
    headersSent: false,
    writableEnded: false,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
      this.headersSent = true;
    },
    end(body = "") {
      this.body += body;
      this.writableEnded = true;
    }
  };
}

try {
  const profileDirectory = path.join(temporaryHome, "profiles", "web");
  await mkdir(profileDirectory, { recursive: true });
  await writeFile(
    path.join(profileDirectory, "package.json"),
    JSON.stringify({
      name: "dsh-profile-web-test",
      private: true,
      dependencies: {
        "dsh-cost-meter": "99.0.0",
        "dsh-mnemon": "0.1.0"
      },
      dsh: { profile: { bundles: [] } }
    }),
    "utf8"
  );
  for (const [name, version] of [["dsh-cost-meter", "99.0.0"], ["dsh-mnemon", "0.1.0"]]) {
    const packageDirectory = path.join(profileDirectory, "node_modules", name);
    await mkdir(packageDirectory, { recursive: true });
    await writeFile(path.join(packageDirectory, "package.json"), JSON.stringify({ name, version }), "utf8");
  }

  const plugin = await import(`./index.js?test=${Date.now()}`);
  assert.deepEqual(plugin.inject, ["webServer"]);

  let registeredRoute = null;
  plugin.apply({
    effect(factory) {
      return factory();
    },
    webServer: {
      register(route) {
        registeredRoute = route;
        return () => {};
      }
    }
  });

  assert.equal(registeredRoute.kind, "prefix");
  assert.equal(registeredRoute.path, "/cn-plugin-center/api");

  const stateResponse = responseRecorder();
  await registeredRoute.handler(
    {
      method: "GET",
      url: "/cn-plugin-center/api/state",
      headers: { host: "127.0.0.1:3080" },
      socket: { remoteAddress: "127.0.0.1" }
    },
    stateResponse
  );
  assert.equal(stateResponse.status, 200);
  const statePayload = JSON.parse(stateResponse.body);
  assert.equal(statePayload.ok, true);
  assert.equal(statePayload.data.plugins.length, 10);
  assert.equal(statePayload.data.mirrors.length, 4);
  assert.equal(statePayload.data.source.registry, "https://registry.npmjs.org/");
  assert.equal(statePayload.data.plugins.find((entry) => entry.id === "dsh-cost-meter").updateAvailable, false);
  assert.equal(statePayload.data.plugins.find((entry) => entry.id === "dsh-mnemon").updateAvailable, true);

  const communityName = "dsh-community-test";
  const communityVersion = "1.2.3";
  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/-/v1/search")) {
      return new Response(JSON.stringify({
        objects: [{
          package: {
            name: communityName,
            version: communityVersion,
            keywords: ["dsh-plugin"]
          },
          searchScore: 10
        }],
        total: 1
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (requestUrl.includes(communityName)) {
      return new Response(JSON.stringify({
        name: communityName,
        "dist-tags": { latest: communityVersion },
        versions: {
          [communityVersion]: {
            name: communityName,
            version: communityVersion,
            description: "Community search fixture",
            keywords: ["dsh-plugin"],
            repository: { url: "https://example.com/dsh-community-test" },
            dsh: { bundle: { patch: "./cordis.patch.yml" } },
            dist: { integrity: "sha512-test-fixture" }
          }
        }
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`Unexpected fetch: ${requestUrl}`);
  };

  const searchResponse = responseRecorder();
  await registeredRoute.handler(
    {
      method: "GET",
      url: "/cn-plugin-center/api/plugins/search?q=community-test&page=1&pageSize=20",
      headers: { host: "127.0.0.1:3080" },
      socket: { remoteAddress: "127.0.0.1" }
    },
    searchResponse
  );
  assert.equal(searchResponse.status, 200);
  const searchPayload = JSON.parse(searchResponse.body);
  assert.equal(searchPayload.data.pageSize, 20);
  assert.equal(searchPayload.data.total, 1);
  assert.equal(searchPayload.data.totalPages, 1);
  assert.equal(searchPayload.data.results[0].id, communityName);
  assert.equal(searchPayload.data.results[0].origin, "community");
  assert.equal(searchPayload.data.results[0].verified, true);

  const lastPageResponse = responseRecorder();
  await registeredRoute.handler(
    {
      method: "GET",
      url: "/cn-plugin-center/api/plugins/search?q=community-test&page=999&pageSize=20",
      headers: { host: "127.0.0.1:3080" },
      socket: { remoteAddress: "127.0.0.1" }
    },
    lastPageResponse
  );
  assert.equal(lastPageResponse.status, 200);
  assert.equal(JSON.parse(lastPageResponse.body).data.page, 1);

  const invalidPageSizeResponse = responseRecorder();
  await registeredRoute.handler(
    {
      method: "GET",
      url: "/cn-plugin-center/api/plugins/search?q=community-test&page=1&pageSize=19",
      headers: { host: "127.0.0.1:3080" },
      socket: { remoteAddress: "127.0.0.1" }
    },
    invalidPageSizeResponse
  );
  assert.equal(invalidPageSizeResponse.status, 400);

  const crossOriginResponse = responseRecorder();
  await registeredRoute.handler(
    {
      method: "POST",
      url: "/cn-plugin-center/api/source/test",
      headers: {
        host: "127.0.0.1:3080",
        origin: "https://example.com",
        "content-type": "application/json",
        "x-dsh-cn-plugin-center": "1"
      },
      socket: { remoteAddress: "127.0.0.1" }
    },
    crossOriginResponse
  );
  assert.equal(crossOriginResponse.status, 403);
  assert.equal(JSON.parse(crossOriginResponse.body).ok, false);

  console.log("dsh-cn-plugin-center tests passed");
} finally {
  globalThis.fetch = originalFetch;
  await rm(temporaryHome, { recursive: true, force: true });
}
