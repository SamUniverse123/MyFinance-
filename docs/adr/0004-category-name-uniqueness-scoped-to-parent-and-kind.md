# Category name uniqueness is scoped to (user, parent, kind), not global per user

Unlike `payees`, which is unique per `(userId, name)`, `categories` has no uniqueness constraint today. We're enforcing uniqueness per `(userId, parentId, kind)` rather than globally per user.

A global-per-user constraint would block a legitimate, common pattern: an "Other" or "Miscellaneous" subcategory recurring under multiple different parents (e.g. under both "Food" and "Transport"). Scoping to `(parentId, kind)` still blocks the case that actually confuses users — two identically-named siblings under the same parent — without over-restricting unrelated branches of the tree.
