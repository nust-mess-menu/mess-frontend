// Cloudflare Workers build (npm run cf:deploy). Every page is rendered per
// request (CSP nonce), so no incremental cache is needed.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
