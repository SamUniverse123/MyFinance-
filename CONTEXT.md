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

**Selected currency**:
The one currency a page's figures are scoped to at a given moment, chosen via the currency toggle. On the dashboard and transactions pages, every amount shown belongs to this single currency — the app never converts between currencies or shows a blended total.
_Avoid_: Display currency (implies conversion into it, which the app does not do)

**Base currency**:
A user's default/primary currency (`userSettings.baseCurrency`). Its role is to set where the currency toggle starts; it is not a conversion target. When unset, the most-common account currency stands in.

**Overall budget**:
A user's single monthly spending ceiling for the **selected currency** (`budgets` table). Independent per currency and independent of any category budgets — it is a rough top-line limit, deliberately not required to equal the sum of category budgets (see [[0010-per-category-budgets-and-budgets-page]]).
_Avoid_: Total budget (ambiguous with "sum of category budgets", which this is not)

**Category budget**:
A monthly spending limit set on a single **top-level expense category** in the **selected currency** (`category_budgets` table). Only top-level `expense` categories can carry one; spend on a subcategory rolls up to its parent's budget. Uncategorized, split, and transfer spend counts toward the overall budget but never toward a category budget.
