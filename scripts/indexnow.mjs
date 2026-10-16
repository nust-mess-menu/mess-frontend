#!/usr/bin/env node
/**
 * Tell IndexNow search engines (Bing, Yandex, Seznam, Naver) that the student
 * pages changed. Runs after `npm run cf:deploy`. The key file
 * public/95d9989cade75f221309a1a245a96d38.txt proves the site owns this key.
 */
const HOST = "nustmessmenu.oddmancy.com";
const KEY = "95d9989cade75f221309a1a245a96d38";
const PATHS = ["/", "/today", "/weekly"];

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList: PATHS.map((path) => `https://${HOST}${path}`),
  }),
});
// 200 and 202 both mean accepted; a failed ping must not fail the deploy
console.log(`indexnow: ${res.status} ${res.ok ? "submitted" : await res.text()}`);
