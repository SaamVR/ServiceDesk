# R37 / CORE-C — NEQ evidence cannot be multi-valued

The production rule evaluator previously evaluated `NEQ` as true when the
stored event snapshot value was an array. This allowed an ambiguous,
multi-valued persisted signal (including both `true` and `false`) to
satisfy a condition explicitly requiring it to differ from `true`.
Such a false match could enqueue an internal attention action or an
approval-dependent external-send action if that rule had one.

This patch requires a known scalar value for NEQ, matching EQ/IN behavior.
Missing facts remain UNKNOWN. The envelope may still retain bounded array
values for future event uses, but they cannot silently satisfy a scalar
comparison. LIVE and synthetic preview evaluations share the same guard.
No provider sends, real event replay or tenant DB changes were made here.
