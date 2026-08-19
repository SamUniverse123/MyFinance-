# Payee deletion uses SET NULL, not the reassignment flow categories use

Unlike categories ([[0003-category-deletion-requires-reassignment]]), deleting a payee doesn't force the user to reassign referencing transactions first. `transactions.payeeId`, `scheduledTransactions.payeeId`, and `rules.setPayeeId` all get `onDelete: 'set null'` — deleting a payee simply clears those references, and affected transactions fall back to displaying their raw `payeeName`.

The reasoning behind the categories decision — that silently falling back would "misrepresent historical spending in reports" — doesn't hold here. Payee is a descriptive lookup field, not load-bearing for any budget or report number the way category is; losing the link just returns a transaction to the same unresolved state it's already allowed to sit in indefinitely (payee resolution is optional by design). Forcing a reassignment flow for a non-reporting field would add friction the categories rationale doesn't justify.
