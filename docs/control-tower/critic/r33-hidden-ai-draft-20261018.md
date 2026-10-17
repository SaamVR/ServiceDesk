# Independent CRITIC L14 — AI model draft hidden action veto

The authoring compiler must not silently discard dangerous nonenumerable own fields such as `sendProviderMessage` hidden by a model-tool adapter. Though the generated draft never auto-sends, accepting input whose actual own keys differ from reviewed keys creates misleading provenance and undermines adversarial validation. Require exact visible own-key parity; reject model candidates with hidden/symbol/prototype fields. The critic does not publish rules or certify live workflows.
