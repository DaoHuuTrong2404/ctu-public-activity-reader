# CTU public activity reader

This standalone reader fetches public Facebook page widgets from four official school pages. It contains no student profile, account session, form answers or credentials. It never fills or submits a registration form.

If published as a separate public repository, standard GitHub Actions can read the pages on a five-minute schedule without consuming private-repository minutes. Scheduled jobs may be delayed. Registration, point limits, deduplication and email remain in the owner's private Cloudflare service.

The reader forwards public posts through a dedicated ingestion credential held in GitHub Actions secrets. That credential can only supply public source snapshots. It cannot change points, submit forms, change settings or read the owner's records. No secrets are committed to this repository.

Supported sources: CTU.dtn.cntttt, khmt.dhct, CTU.Youth, CTU.dtn.kt. The reader follows bounded public redirects, does not log in, and reports login requirements or missing posts honestly.

Run a read-only check with Node.js 22 or newer:

```sh
node read-public.mjs
```

Environment variables `SOURCE_FEED_URL` and `SOURCE_FEED_KEY` enable authenticated snapshot delivery. A missing key keeps the process read-only.
