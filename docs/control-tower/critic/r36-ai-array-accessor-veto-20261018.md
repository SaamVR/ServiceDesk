# R36 independent critic — model-array accessor and sparse data veto

A crafted in-memory model/connector response may include accessor or sparse arrays instead of JSON arrays. Calling Array.prototype.some/map on an accessor list can throw and escape the guard; a sparse list can be silently interpreted as no exceptions. The output/command guard must prove each array element is an own data property before reading. This is an adversarial contract test, not proof of a live network exploit. Do not merge producer until corrected and exact full CI passes.
