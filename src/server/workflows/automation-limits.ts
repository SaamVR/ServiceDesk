/**
 * Hard upper bound on active, tenant-scoped rule reads per saved milestone.
 * The built-in catalog currently contains 27 recipes, distributed across
 * five events. The 64-rule cap leaves room for owner-authored rules without
 * allowing unbounded, privileged fan-out on one event.
 */
export const MAX_ACTIVE_WORKFLOW_RULES_PER_BRANCH = 64;
export const WORKFLOW_RULE_OVERFLOW_FETCH_LIMIT = MAX_ACTIVE_WORKFLOW_RULES_PER_BRANCH + 1;
