# Independent L14 dispatch runtime-safety veto

A recovered visit with a null startAt must never throw during the recommendation sort before eligibility is checked. This adversarial case demands fail-closed SCHEDULE_UNVERIFIED and no auto-approval instead of a route/UI crash. Tests are source-only synthetic malformed data, not live scheduler proof.
