# Section-view beacon worker

A small Cloudflare Worker that records which sections of `dhruv.html` (and the
landing / lab pages) get scrolled into view by readers. Data is written to the
`section_views_dhruv` Workers Analytics Engine dataset; nothing else stores it.

## Deploy

```sh
cd worker
wrangler login          # one-time OAuth, opens browser
wrangler deploy
```

The deploy creates two things on Cloudflare:

- A worker named `zetesislabs-section-view` in the
  `Samanway@zetesislabs.com's Account` account (id
  `75a11ac71fbcc3ddc793675245c3d95b`).
- A worker route on the `zetesislabs.com` zone matching
  `zetesislabs.com/api/section-view`.

If `wrangler login` is awkward (no browser available), set
`CLOUDFLARE_API_TOKEN` to a token with `Workers Scripts:Edit` and
`Workers Routes:Edit` on this account, then run `wrangler deploy` directly.

## Querying the data

After the worker is live and a few beacons have accumulated, the dataset is
queryable via the Cloudflare GraphQL API. Example query (substitute account
and date range):

```graphql
query SectionViews($acct: String!, $since: Time!, $until: Time!) {
  viewer {
    accounts(filter: { accountTag: $acct }) {
      analyticsEngineEvents(
        filter: { dataset_eq: "section_views_dhruv", timestamp_geq: $since, timestamp_lt: $until }
        limit: 10000
      ) {
        timestamp
        blob1   # sectionId
        blob2   # path
        blob3   # country
        blob5   # bot | human
      }
    }
  }
}
```

For monthly rollups by section, use `analyticsEngineDatasets` with a `count`
aggregation grouped by `blob1`.

## Code layout

- `src/section-view.js`: the worker. Single export, handles `POST` and CORS.
- `wrangler.toml`: route + Analytics Engine binding.

## Privacy notes

- No IP, cookie, or fingerprint is stored.
- `sessionId` is a per-tab opaque token generated client-side. Not persisted
  across tabs, not linked to identity.
- Bot vs human is heuristic from User-Agent only; both classes are stored so
  the data can be filtered after the fact.
