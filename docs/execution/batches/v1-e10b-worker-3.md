# V1 E10B Worker 3 — Customer Quote Acceptance + Sandbox Checkout Product

Branch: feat/servicedesk-v1-product-e10b
Base: 25e5770e96b250923c81254f0477461fc89feb4f

Mission:
- wire customer quote acceptance to frozen Core acceptQuote;
- use existing findSlots/holdSlot Product command boundaries for the customer booking path;
- add an injected SANDBOX checkout-launch port consuming safe Connector output;
- enable checkout UI only after accepted quote + valid hold + injected sandbox checkout command;
- never show paid/confirmed truth until verified Core payment state arrives;
- keep fixture/server/sandbox labels explicit;
- update portal quote/booking route boundaries and final guided journey model;
- package-free acceptance harness and tests;
- browser PASS remains blocked unless browser actually runs.

Receipt: docs/execution/receipts/v1-e10b-worker-3.md
