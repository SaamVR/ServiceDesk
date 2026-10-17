# R30 CORE-O — owner opt-in requires unambiguous active pricing

Problem: prior `verifyOwnerQuoteAutomationPrerequisites` placed all usable books in a Set of branches. One good effective book could conceal another overlapping effective active book or malformed effective window. A tenant could then enable automated quote follow-up even when the actual pricing model would treat the saved branch pricing as inconsistent.

Change: require **exactly one effective active book** in a USD branch, with a real valid active rate card. A second active effective book, including one with a missing rate card, disqualifies the branch. Timestamp boundaries must have explicit timezone, real civil date, valid bounds and cannot invert start/end. A valid expired or future nonoverlapping book does not block current pricing; ordinary valid single-book activation is unchanged. Owner emergency disable remains independent and available.

Tests cover duplicate concurrent books, a dangling second book, overlapping price windows, impossible dates, missing offsets, invalid offsets, reversed windows, harmless future/expired books and explicit timezone offsets.

No schema edits, remote-device use, connected database writes, customer/provider effects or production activation. These are source contract tests, not a real owner acceptance.
