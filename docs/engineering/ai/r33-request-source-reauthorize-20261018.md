# L02 R33 — Post-generation AI request state and staff revalidation

The request copilot formerly verified saved request state before a potentially slow provider call but returned its draft without a second source/actor read. During a ~25–45-second inference, an owner may revoke a dispatcher or change the request's status, catalog service, bedrooms, bathrooms or branch. This lane rereads actor identity/role/branch and the same persisted request plus referenced catalog code after model output validation, failing closed on changed fields and cancellation. No secrets, customer contact text, financial facts, provider send or DB writes are exposed or performed.

Four positive/negative scenarios cover unchanged request, state drift, actor revocation and cancellation. This is source-only acceptance until a real two-owner signed-in tenant and slow V4 model call are authorized.
