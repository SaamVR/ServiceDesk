# R36 independent photo-AI critic — optional-field type coercion veto

A model could send an object in `proposedAddOnCode` or `rationale` carrying hidden approval/sending instructions. The original parser silently replaced unsupported types with undefined and could label the remainder a valid classification. Preserve zero automatic actions: reject untrusted optional fields instead of quietly discarding them. Separate critic test; no image or real merchant record accessed.
