# Payee logos via logo.dev, with an optional stored domain

Payees gain brand logos sourced from **logo.dev**. This adds a nullable `payees.domain`
column, a client-side image hotlink, and a server-side search proxy — a real external
dependency worth recording.

## Decisions

- **Optional `domain` per payee.** A nullable `payees.domain` (bare hostname, e.g.
  `netflix.com`) drives the logo. When set, the logo comes from `img.logo.dev/{domain}`;
  when null, we attempt a name-based lookup (`img.logo.dev/name/{name}`); a miss (or no
  API key) falls back to an app-styled initials avatar. Domain wins because name lookups
  are ambiguous for the local businesses that dominate this app's data.

- **Two keys, split by exposure.** Logo *images* use the **publishable** key
  (`VITE_LOGO_DEV_PUBLISHABLE_KEY`) hotlinked directly from the browser — it's designed
  to be public. **Brand Search** (name→domain typeahead in the add/edit payee modals)
  uses the **secret** key (`LOGO_DEV_SECRET_KEY`) and *must* go through a server proxy
  (`GET /api/payees/brand-search`); the secret key never reaches the client. Both keys
  are optional: absent → logos become initials and search returns nothing, so the app
  still runs without a logo.dev account.

- **`fallback=404`, not the default monogram.** logo.dev serves its own grey monogram
  (HTTP 200) for misses by default, which we can't distinguish from a real logo. We
  request `fallback=404` so a miss is a real 404 and the `<img>` `onError` can swap in
  our own initials tile — keeping fallbacks visually consistent with the rest of the app.

- **Attribution.** The free tier requires a visible credit; a single "Logos provided by
  Logo.dev" link sits in the Payees management footer rather than on every transaction row.

## Considered and rejected

- **Auto-resolving name→domain silently** (calling Brand Search on every payee save):
  rejected — for local businesses it often returns nothing or a *wrong* company, silently
  attaching an incorrect logo. Domain is set explicitly (via the brand-search *pick* or a
  manual Website field), never guessed behind the user's back.
