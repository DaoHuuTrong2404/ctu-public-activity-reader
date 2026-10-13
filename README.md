# CTU public activity reader

This standalone reader fetches public Facebook page widgets from four official school pages. It contains no student profile, account session, form answers or credentials. It never fills or submits a registration form.

If published as a separate public repository, standard GitHub Actions can read the pages on a five-minute schedule without consuming private-repository minutes. Scheduled jobs may be delayed. Registration, point limits, deduplication and email remain in the owner's private Cloudflare service.

The reader forwards public posts through a dedicated ingestion credential held in GitHub Actions secrets. That credential can only supply public source snapshots. It cannot change points, submit forms, change settings or read the owner's records. No secrets are committed to this repository.

A separate monthly maintenance workflow records a truthful health report about these public pages. Its write permission applies only to this repository; the five-minute reader remains read-only. This keeps an observable maintenance history and regular repository activity. Scheduled workflows can otherwise be disabled after 60 days without repository activity ([GitHub documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)).

Supported sources: CTU.dtn.cntttt, khmt.dhct, CTU.Youth, CTU.dtn.kt. The reader follows bounded public redirects, does not log in, and reports login requirements or missing posts honestly.

Run a read-only check with Node.js 22 or newer:

```sh
node read-public.mjs
```

Environment variables `SOURCE_FEED_URL` and `SOURCE_FEED_KEY` enable authenticated snapshot delivery. A missing key keeps the process read-only.
