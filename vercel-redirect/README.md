# Old Vercel address -> nustmessmenu.oddmancy.com

Deployed to the old Vercel project behind `mess-menu-six.vercel.app` (taaha64's
Vercel account). Every path gets a 301 to the same path on the new domain, so
bookmarks keep working and search engines move the old ranking to the new URL.

```bash
cd vercel-redirect
npx vercel link      # pick the project that owns mess-menu-six.vercel.app
npx vercel deploy --prod
```
