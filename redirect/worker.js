// eat.taaha.dev -> eat.oddmancy.com (the site's old address).
// Permanent redirect keeping path and query, so old links and bookmarks work.
const TARGET = "https://eat.oddmancy.com";

export default {
  fetch(request) {
    const url = new URL(request.url);
    return new Response(null, {
      status: 301,
      headers: {
        Location: TARGET + url.pathname + url.search,
        "Cache-Control": "public, max-age=86400",
      },
    });
  },
};
