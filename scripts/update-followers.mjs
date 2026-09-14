import { readFileSync, writeFileSync } from "node:fs";

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

async function getYoutubeSubscribers(handle, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${handle}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API request failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const stats = json.items?.[0]?.statistics;
  if (!stats) throw new Error(`No YouTube channel found for handle ${handle}`);
  return Number(stats.subscriberCount);
}

// Instagram via Behold (behold.so) — a free hosted feed service that holds its
// own Meta-approved app, so connecting the account is just an Instagram login
// popup instead of the Meta developer portal. Behold refreshes the Graph API
// token itself, so there is no 60-day expiry to babysit here.
async function getBeholdFeed(feedUrl) {
  if (!feedUrl) {
    throw new Error("BEHOLD_FEED_URL not set — see setup steps in .github/workflows/update-followers.yml, or edit data/followers.json manually");
  }
  const res = await fetch(feedUrl);
  if (!res.ok) throw new Error(`Behold request failed: ${res.status}`);
  return res.json();
}

// ponytail: TikTok embeds the profile's stats object straight in the page HTML
// (no login wall, unlike Instagram). Fragile — if TikTok changes this markup,
// the regex below needs updating. Falls back to the last known value on failure.
async function getTiktokFollowers(handle) {
  const res = await fetch(`https://www.tiktok.com/@${handle}`, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`TikTok request failed: ${res.status}`);
  const html = await res.text();
  const match = html.match(/"followerCount":(\d+)/);
  if (!match) throw new Error("followerCount not found in TikTok page (likely blocked or markup changed)");
  return Number(match[1]);
}

const path = new URL("../data/followers.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf-8"));

const jobs = [
  ["youtube", () => getYoutubeSubscribers("@mxjclabs", process.env.YOUTUBE_API_KEY)],
  ["tiktok", () => getTiktokFollowers("mxjc.labs")],
];

for (const [key, run] of jobs) {
  try {
    data[key] = await run();
    console.log(`${key}: ${data[key]}`);
  } catch (err) {
    console.warn(`${key}: keeping previous value (${data[key]}) — ${err.message}`);
  }
}

try {
  const feed = await getBeholdFeed(process.env.BEHOLD_FEED_URL);
  if (feed.followersCount == null) throw new Error("followersCount missing in Behold feed response");
  data.instagram = Number(feed.followersCount);
  console.log(`instagram: ${data.instagram}`);
} catch (err) {
  console.warn(`instagram: keeping previous value (${data.instagram}) — ${err.message}`);
}

data.updatedAt = new Date().toISOString();
writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
