# V3 real-Chrome PUBLIC browser proof

The isolated job runs a local production build in a fresh, cookie-free Chrome profile. It captures the homepage, features, pricing, integrations, contact, and sign-in at 320, 390, 834, 1280 and 1440 CSS pixels, first-fold and mid-page: **60 PNGs / 30 responsive checks**. It checks HTTP 200, a main landmark and heading, reduced-motion emulation and horizontal overflow.

Only deliberately public product routes are visited; screenshots have seven-day retention in GitHub Actions and contain no customer/tenant information.

**This is not authenticated Studio OS acceptance.** Real tenant data and staff workflows must still be tested using \`tests/e2e/v3-capture-workroom.mjs\` against an owner-approved, exact-SHA isolated preview. Those 40 authenticated staff screenshots must be reviewed privately and never uploaded to GitHub artifacts. Cross-check the deployed source SHA independently and obtain owner approval. Do not bypass issue #75 (Supabase migrations 0037–0059) or enable registration.

No payment sends, Meta callbacks, production credentials, SQL migrations or device filesystem changes are part of this lane.
