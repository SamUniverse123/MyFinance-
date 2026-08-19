# MyFinance

A personal finance ledger: users track accounts, transactions, and how their money is categorized.

## Language

**Category**:
A user-owned label for classifying a transaction as income or expense (e.g. "Groceries", "Rent"). Categories form a hierarchy capped at two levels — a top-level category may have subcategories, but nesting stops there.
_Avoid_: Tag (a separate many-to-many label, unrelated to categorization), Type (ambiguous with account type)

**Subcategory**:
A category with a parent category. Cannot itself have children. Always shares its parent's kind.

**Category kind**:
Whether a category classifies income or expense. Set at creation; a subcategory must match its parent's kind — a tree never mixes both.

**System category**:
A category seeded automatically for a user (rather than user-created), protected from deletion and renaming but not from color/icon changes. Because every category row belongs to exactly one user, a system category is seeded per-user, not a single shared global row.

**Net worth**:
Sum of a user's account balances in the **selected currency** only. Currencies are never converted or blended together (see [[0009-currency-toggle-not-fx-conversion]]); to see net worth in another currency the user switches the currency toggle to it.
_Avoid_: Total balance (ambiguous about whether it includes liabilities or other currencies)

**Net cashflow**:
Income minus expenses over a given period (e.g. the current month), within the selected currency. Positive means more came in than went out.
_Avoid_: Net income (overloaded with accounting/tax meaning outside this app)

**Spend**:
Total money-out for the **selected currency** over a period: expense-category outflows plus uncategorized and split outflows, with internal transfers excluded and refunds netted against their category by sign. Defined identically to the "overall spent" figure on the budgets page so the two surfaces can never disagree ([[0010-per-category-budgets-and-budgets-page]]). Surfaced as **Spending** in the UI (and the name of its page); `spend` in code; the raw dashboard API field is `expense`.
_Avoid_: Expense as the aggregate noun (reserve it for the [[category kind]] and the raw API field, not the money-out total)

**Selected currency**:
The one currency a page's figures are scoped to at a given moment, chosen via the currency toggle. On the dashboard and transactions pages, every amount shown belongs to this single currency — the app never converts between currencies or shows a blended total.
_Avoid_: Display currency (implies conversion into it, which the app does not do)

**Base currency**:
A user's default/primary currency (`userSettings.baseCurrency`). Its role is to set where the currency toggle starts; it is not a conversion target. When unset, the most-common account currency stands in.

**Overall budget**:
A user's monthly spending ceiling for the **selected currency** (`budgets` table). Independent per currency and independent of any category budgets — a rough top-line limit, deliberately not required to equal the sum of category budgets (see [[0010-per-category-budgets-and-budgets-page]]). **Effective-dated** (see [[0015-effective-dated-budgets]]): each row applies from its month onward, so different months can have different limits.
_Avoid_: Total budget (ambiguous with "sum of category budgets", which this is not)

**Category budget**:
A monthly spending limit set on a single **top-level expense category** in the **selected currency** (`category_budgets` table). Only top-level `expense` categories can carry one; spend on a subcategory rolls up to its parent's budget. Uncategorized, split, and transfer spend counts toward the overall budget but never toward a category budget. **Effective-dated** like the overall budget ([[0015-effective-dated-budgets]]).

**Effective budget**:
A budget's value *as of* a given month: the amount from the most recent row at or before that month (`budgets`/`category_budgets` are dated histories, not single constants — [[0015-effective-dated-budgets]]). Setting a budget while viewing a month applies it from that month forward; clearing writes a null-amount **tombstone** from that month forward. Neither ever rewrites earlier months.
_Avoid_: Current budget (ambiguous about which month's value it means)

**Payee**:
A user-owned entity representing who a transaction's counterparty was (e.g. "Starbucks", "Employer Inc"). Unique per `(userId, name)` (`payees` table).
_Avoid_: Merchant (a payee can be a person or employer, not just a business)

**Payee resolution**:
Linking a transaction's raw `payeeName` string (exactly as typed or imported, e.g. `"SQ *BLUE BOTTLE 4412"`) to a canonical **Payee** via `payeeId`. Happens when a [[rule]] matches or the user picks/creates one from a combobox. Resolution is optional — `payeeId` may stay null indefinitely, and the UI falls back to showing raw `payeeName` when it is.

**Payee domain**:
An optional bare hostname on a **Payee** (`payees.domain`, e.g. `netflix.com`) used solely to fetch its brand logo from logo.dev (see [[0014-payee-logos-via-logo-dev]]). Set by picking a brand-search result or typing a website; null means the logo is attempted by name, then falls back to an initials avatar. Not a domain the app communicates with — purely a logo lookup key.
_Avoid_: Website (implies a link the user visits; this is a logo identifier)

**Rule**:
A user-defined condition (`match_field`/`match_op`/`match_value`) that, when it matches a transaction, fills in a blank `category_id` and/or `payee_id` — never overwrites a value the user already set. Schema exists (`rules` table); no application code runs them yet.

**Recurring transaction**:
A template that posts a transaction automatically on a schedule (`scheduled_transactions` table) — e.g. monthly rent, a salary deposit. Distinct from an ordinary [[payee]]-linked transaction, which is a single recorded event. Surfaced as the "Recurring" tab on the transactions page, which is a placeholder until the feature is built.
_Avoid_: Scheduled payment (implies an outgoing bill specifically; a recurring transaction can be income too)
