# Net worth sums only base-currency accounts; other currencies are separate subtotals, unconverted

No `fxRates` table exists, and `accounts.md` already rules out inventing a 1:1 conversion rate. Rather than build FX-rate infrastructure now, the dashboard's net-worth figure sums only accounts whose currency matches the user's `userSettings.baseCurrency`; accounts in other currencies are shown as their own unconverted subtotals, not folded into the headline number.

This satisfies the "never fake a rate" rule without building the machinery to satisfy it properly — there's currently no real multi-currency usage in the dev data to design real conversion against. A future reader seeing a net-worth number that silently excludes some accounts should know it's deliberate, not a bug: build real FX conversion when a user actually needs it.
