// Live, plain menu pages for search engines and AI assistants (ChatGPT,
// Gemini, Claude...), which read HTML without running JavaScript:
//   /today      today's menu in Pakistan time, as minimal HTML
//   /today.txt  the same as plain text
//   /week.txt   this week's menu as plain text
// Only these paths run this Worker (run_worker_first in wrangler.jsonc);
// every other request is a static file and never reaches it.

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MEALS = [
  { type: "breakfast", label: "Breakfast", weekday: [450, 570], weekend: [540, 630] },
  { type: "lunch", label: "Lunch", weekday: [780, 930], weekend: [840, 930] },
  { type: "dinner", label: "Dinner", weekday: [1170, 1290], weekend: [1170, 1290] },
];
const CACHE_SECONDS = 60;
const SITE = "https://nustmessmenu.oddmancy.com";

const clock = (minutes) => {
  const h = Math.floor(minutes / 60);
  return `${((h + 11) % 12) + 1}:${String(minutes % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const isWeekend = (day) => day === "saturday" || day === "sunday";
const windowOf = (meal, day) => (isWeekend(day) ? meal.weekend : meal.weekday);
const timing = (meal, day) => windowOf(meal, day).map(clock).join(" - ");
const dishes = (slot) => (Array.isArray(slot?.items) && slot.items.length ? slot.items.join(", ") : "not set");
const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Current date, weekday and minutes after midnight in Pakistan */
function pakistanNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Karachi",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return {
    label: `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** "Lunch is being served now" / "Dinner is next, at 7:30 PM" */
function servingNote(day, minutes) {
  for (const meal of MEALS) {
    const [start, end] = windowOf(meal, day);
    if (minutes >= start && minutes < end) return `${meal.label} is being served now (until ${clock(end)}).`;
    if (minutes < start) return `${meal.label} is next, from ${clock(start)}.`;
  }
  return "Dinner has finished; the next meal is tomorrow's breakfast.";
}

const dateLabel = (iso) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`)
  );

function todayText(menu, now) {
  const lines = [
    `NUST hostel mess menu for today, ${dateLabel(menu.date)} (Pakistan time, PKT, UTC+5)`,
    `Current time in Pakistan: ${clock(now.minutes)}. ${servingNote(menu.day, now.minutes)}`,
    "",
    ...MEALS.map((m) => `${m.label} (${timing(m, menu.day)}): ${dishes(menu.meals?.[m.type])}`),
    "",
    `Live, always current. This week: ${SITE}/week.txt  Full site with ratings: ${SITE}/`,
  ];
  return lines.join("\n") + "\n";
}

function weekText(week) {
  const lines = [`NUST hostel mess menu for the week of ${dateLabel(week.startDate)} to ${dateLabel(week.endDate)} (Pakistan time)`, ""];
  DAYS.forEach((day, i) => {
    const date = new Date(Date.parse(`${week.startDate}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
    lines.push(dateLabel(date));
    for (const m of MEALS) lines.push(`  ${m.label} (${timing(m, day)}): ${dishes(week.menu?.[day]?.[m.type])}`);
    lines.push("");
  });
  lines.push(`Today's menu only: ${SITE}/today.txt`);
  return lines.join("\n") + "\n";
}

function todayHtml(menu, now) {
  const date = dateLabel(menu.date);
  const title = `NUST Mess Menu Today - ${date}`;
  const rows = MEALS.map(
    (m) => `<li><strong>${m.label}</strong> (${timing(m, menu.day)}): ${escape(dishes(menu.meals?.[m.type]))}</li>`
  ).join("\n");
  const description = MEALS.map((m) => `${m.label}: ${dishes(menu.meals?.[m.type])}`).join(". ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(`Today's NUST hostel mess menu, ${date}. ${description}.`)}">
<link rel="canonical" href="${SITE}/today">
<link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png">
</head>
<body style="max-width:40rem;margin:2rem auto;padding:0 1rem;font-family:system-ui,sans-serif;line-height:1.6">
<h1>NUST Mess Menu today</h1>
<p><strong>${escape(date)}</strong> (Pakistan time, PKT, UTC+5).<br>
Current time in Pakistan: ${clock(now.minutes)}. ${escape(servingNote(menu.day, now.minutes))}</p>
<ul>
${rows}
</ul>
<p>This page is generated live from the menu, so it always shows today's meals in Pakistan.
Plain text: <a href="/today.txt">/today.txt</a> &middot; this week: <a href="/week.txt">/week.txt</a></p>
<p><a href="/">Open the full menu with ratings and reviews</a> &middot; <a href="/weekly">This week's menu</a></p>
</body>
</html>
`;
}

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

async function render(path, env) {
  const endpoint = path === "/week.txt" ? "/api/v2/menu/week" : "/api/v2/menu/today";
  const upstream = await fetch(new URL(endpoint, env.API_BASE_URL), { headers: { Accept: "application/json" } });
  if (!upstream.ok) throw new Error(`menu API answered ${upstream.status}`);
  const data = await upstream.json();
  const now = pakistanNow();

  if (path === "/week.txt") return { body: weekText(data), type: "text/plain" };
  if (path === "/today.txt") return { body: todayText(data, now), type: "text/plain" };
  return { body: todayHtml(data, now), type: "text/html" };
}

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!["/today", "/today.txt", "/week.txt"].includes(url.pathname)) return env.ASSETS.fetch(request);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });

    // One render per minute per Cloudflare location, whatever the traffic
    const cacheKey = new Request(url.origin + url.pathname);
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      // Cloudflare rewrites Cache-Control on cache hits to the zone's browser
      // TTL (hours); this page changes at midnight, so set it again
      const response = new Response(request.method === "HEAD" ? null : cached.body, cached);
      response.headers.set("Cache-Control", `public, max-age=${CACHE_SECONDS}`);
      return response;
    }

    let response;
    try {
      const { body, type } = await render(url.pathname, env);
      response = new Response(body, {
        headers: {
          ...SECURITY_HEADERS,
          "Content-Type": `${type}; charset=utf-8`,
          "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
        },
      });
      ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    } catch (error) {
      console.error(error);
      response = new Response(`The menu is unavailable right now. Try ${SITE}/ in a minute.\n`, {
        status: 503,
        headers: { ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "60" },
      });
    }
    return request.method === "HEAD" ? new Response(null, response) : response;
  },
};

export default worker;
