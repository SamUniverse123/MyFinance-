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
Sum of a user's account balances in their `baseCurrency` only (see [[0006-net-worth-base-currency-only-no-fx]]). Accounts in other currencies are reported as separate unconverted subtotals, never folded into this number.
_Avoid_: Total balance (ambiguous about whether it includes liabilities or other currencies)

**Net cashflow**:
Income minus expenses over a given period (e.g. the current month). Positive means more came in than went out.
_Avoid_: Net income (overloaded with accounting/tax meaning outside this app)
