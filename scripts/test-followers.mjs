import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { instagramCount, syncFollowers, validateCount } from "./update-followers.mjs";

const oldTime = "2026-10-30T02:25:10.601Z";
const checkTime = "2026-11-03T03:50:44.473Z";
const quiet = { log() {}, warn() {} };

test("partial failure preserves the count and the last successful fetch time", async () => {
  const previous = {
    instagram: 10894, youtube: 159, updatedAt: oldTime,
    platforms: { instagram: { lastSuccessAt: oldTime, status: "ok" } },
  };
  const snapshot = structuredClone(previous);
  const result = await syncFollowers(previous, [
    ["instagram", async () => { throw new Error("Disconnected"); }],
    ["youtube", async () => "160"],
  ], checkTime, quiet);
  assert.equal(result.instagram, 10894);
  assert.equal(result.youtube, 160);
  assert.equal(result.platforms.instagram.status, "error");
  assert.equal(result.platforms.instagram.lastSuccessAt, oldTime);
  assert.equal(result.platforms.youtube.lastSuccessAt, checkTime);
  assert.equal(result.checkedAt, checkTime);
  assert.equal(result.updatedAt, undefined);
  assert.deepEqual(previous, snapshot);
});

test("legacy attempt timestamps never become successful-fetch timestamps on failure", async () => {
  const result = await syncFollowers({ instagram: 10894, updatedAt: oldTime }, [
    ["instagram", async () => null],
  ], checkTime, quiet);
  assert.equal(result.instagram, 10894);
  assert.equal(result.platforms.instagram.lastSuccessAt, undefined);
  assert.equal(result.platforms.instagram.status, "error");
});

test("a successful retry clears a previous fetch error and accepts decreases", async () => {
  const result = await syncFollowers({ instagram: 10894, platforms: { instagram: { status: "error" } } }, [
    ["instagram", async () => 10890],
  ], checkTime, quiet);
  assert.equal(result.instagram, 10890);
  assert.equal(result.platforms.instagram.status, "ok");
  assert.equal(result.platforms.instagram.lastSuccessAt, checkTime);
});

test("rejects missing, malformed, negative, fractional and unsafe counts", () => {
  for (const value of [undefined, null, "", " ", false, [], {}, NaN, Infinity, -1, 1.5, "11.1K", Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validateCount(value), String(value));
  }
  assert.equal(validateCount(0), 0);
  assert.equal(validateCount("11123"), 11123);
});

test("Instagram numbers must belong to the intended account", () => {
  assert.equal(instagramCount({ username: "mxjclabs", followersCount: 11123 }), 11123);
  assert.throws(() => instagramCount({ username: "another-account", followersCount: 11123 }));
  assert.throws(() => instagramCount({ followersCount: 11123 }));
  assert.throws(() => instagramCount({ username: "mxjclabs" }));
});

async function renderReach(response) {
  const makeElement = () => ({ textContent: "", style: {}, classList: { add() {}, remove() {} }, addEventListener() {} });
  const elements = Object.fromEntries(["reach-grid", "reach-total", "reach-label", "reach-updated"].map(id => [id, makeElement()]));
  const rows = ["instagram", "tiktok", "youtube"].map(platform => {
    const count = makeElement();
    const bar = makeElement();
    return { ...makeElement(), dataset: { platform, label: platform === "instagram" ? "Instagram" : platform },
      querySelector: selector => selector === "[data-count]" ? count : bar };
  });
  const source = readFileSync(new URL("../script.js", import.meta.url), "utf8")
    .split("// ---- Reach ledger ----")[1].split("// ---- Crosshair cursor")[0];
  let options;
  runInNewContext(source, {
    document: { getElementById: id => elements[id], querySelectorAll: () => rows },
    matchMedia: () => ({ matches: true }),
    IntersectionObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback([{ isIntersecting: true }], this); } disconnect() {} },
    fetch: async (url, init) => { options = init; return response; },
  });
  await new Promise(resolve => setImmediate(resolve));
  return { elements, rows, options };
}

test("cached HTTP-200 counts are labelled checked, never freshly synced", async () => {
  const { elements, options } = await renderReach({ ok: true, json: async () => ({ instagram: 10894, tiktok: 7928, youtube: 159, updatedAt: checkTime }) });
  assert.equal(options.cache, "no-cache");
  assert.equal(elements["reach-total"].textContent, "18,981");
  assert.match(elements["reach-updated"].textContent, /checked Nov 3, 2026/);
  assert.match(elements["reach-updated"].textContent, /Instagram may be delayed/);
  assert.doesNotMatch(elements["reach-updated"].textContent, /last updated|Auto-synced/);
});

test("failed refreshes are visible while last available counts remain displayed", async () => {
  const { elements } = await renderReach({ ok: true, json: async () => ({ instagram: 10894, checkedAt: checkTime, platforms: { instagram: { status: "error" } } }) });
  assert.equal(elements["reach-total"].textContent, "10,894");
  assert.match(elements["reach-updated"].textContent, /Could not refresh: Instagram/);
});

test("a failed JSON request shows unavailable instead of zero followers", async () => {
  const { elements, rows } = await renderReach({ ok: false });
  assert.equal(elements["reach-total"].textContent, "—");
  assert.ok(rows.every(row => row.querySelector("[data-count]").textContent === "—"));
  assert.match(elements["reach-updated"].textContent, /temporarily unavailable/);
});
