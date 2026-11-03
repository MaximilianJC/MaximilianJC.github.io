import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

async function getYoutubeSubscribers(handle, apiKey) {
  if (!apiKey) throw new Error("YOUTUBE_API_KEY not set");
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${handle}&key=${apiKey}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`YouTube API request failed: ${res.status}`);
  const json = await res.json();
  const stats = json.items?.[0]?.statistics;
  if (!stats) throw new Error(`No YouTube channel found for handle ${handle}`);
  return stats.subscriberCount;
}

// Instagram via Behold (behold.so) — a free hosted feed service that holds its
// own Meta-approved app, so connecting the account is just an Instagram login
// popup instead of the Meta developer portal. Behold refreshes the Graph API
// token itself, but Instagram can still revoke access. A disconnected feed can
// keep returning cached counts with HTTP 200; fetching it does not prove freshness.
async function getBeholdFeed(feedUrl) {
  if (!feedUrl) {
    throw new Error("BEHOLD_FEED_URL not set — see setup steps in .github/workflows/update-followers.yml, or edit data/followers.json manually");
  }
  const res = await fetch(feedUrl, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Behold request failed: ${res.status}`);
  return res.json();
}

// ponytail: TikTok embeds the profile's stats object straight in the page HTML
// (no login wall, unlike Instagram). Fragile — if TikTok changes this markup,
// the regex below needs updating. Falls back to the last known value on failure.
async function getTiktokFollowers(handle) {
  const res = await fetch(`https://www.tiktok.com/@${handle}`, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`TikTok request failed: ${res.status}`);
  const html = await res.text();
  const match = html.match(/"followerCount":(\d+)/);
  if (!match) throw new Error("followerCount not found in TikTok page (likely blocked or markup changed)");
  return Number(match[1]);
}

export function validateCount(value) {
  if (typeof value !== "number" && !(typeof value === "string" && /^\d+$/.test(value))) {
    throw new Error("Missing or invalid follower count");
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid follower count");
  return count;
}

export function instagramCount(feed) {
  if (feed?.username?.toLowerCase() !== "mxjclabs") {
    throw new Error("Behold feed does not identify the expected Instagram account mxjclabs");
  }
  return validateCount(feed.followersCount);
}

export async function syncFollowers(previous, jobs, checkedAt = new Date().toISOString(), logger = console) {
  const data = { ...previous, platforms: { ...previous.platforms }, checkedAt };
  // The old updatedAt was the attempt time, including failed requests. Do not
  // migrate it into a success timestamp or claim it is the source's update time.
  delete data.updatedAt;
  for (const [key, run] of jobs) {
    const platform = { ...data.platforms[key], checkedAt };
    try {
      data[key] = validateCount(await run());
      platform.status = "ok";
      platform.lastSuccessAt = checkedAt;
      logger.log(`${key}: ${data[key]}`);
    } catch (err) {
      platform.status = "error";
      logger.warn(`${key}: keeping previous value (${data[key]}) — ${err.message}`);
    }
    data.platforms[key] = platform;
  }
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = new URL("../data/followers.json", import.meta.url);
  const previous = JSON.parse(readFileSync(path, "utf-8"));
  const data = await syncFollowers(previous, [
    ["youtube", () => getYoutubeSubscribers("@mxjclabs", process.env.YOUTUBE_API_KEY)],
    ["tiktok", () => getTiktokFollowers("mxjc.labs")],
    ["instagram", async () => instagramCount(await getBeholdFeed(process.env.BEHOLD_FEED_URL))],
  ]);
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  // Persist successful platforms and failure metadata before flagging the run.
  if (Object.values(data.platforms).some(platform => platform.status === "error")) process.exitCode = 1;
}
