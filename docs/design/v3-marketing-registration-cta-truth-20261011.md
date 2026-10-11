# V3 marketing release-truth gate

Self-service signup remains disabled pending Supabase migrations 0037–0059, owner RPC, email confirmation proof and issue #75. The former public “Create account” link pointed to a disabled signup. Marketing now uses the **same deployment gate as the registration page**, offering a read-only tour instead of unusable account creation. The homepage links to distinct tour/features routes during the closed period, and automatically restores signup after the gate is explicitly enabled. Existing staff sign-in remains unchanged.

The contact route supplies a walkthrough checklist, not an actual meeting booking service; labels no longer claim booking. No database, auth, payment or provider flags are modified.
