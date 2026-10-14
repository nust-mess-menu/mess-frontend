# Old Vercel address -> nustmessmenu.oddmancy.com

Deployed to the old Vercel project behind `mess-menu-six.vercel.app` (taaha64's
Vercel account). Every path gets a 301 to the same path on the new domain, so
bookmarks keep working and search engines move the old ranking to the new URL.

Vercel project: `mess-menu-redirect` (owns the `mess-menu-six.vercel.app` domain).

Deploy from a copy **outside this git repo**. The Hobby plan blocks deployments
whose git commit author isn't the Vercel account owner:

```bash
D=$(mktemp -d) && cp -R vercel.json public .vercel "$D"/ && cd "$D"
npx vercel deploy --prod --yes
```
