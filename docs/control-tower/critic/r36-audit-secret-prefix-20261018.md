# Independent CRITIC R36 — deceptive safe-identifier API keys

The source audit renderer uses a safe-character regex. That does not guarantee confidentiality: synthetic API key text can contain only letters/underscores and still pass as a tool name or model label. Regression asserts such strings never appear in any output field. Producer must distinguish syntactic shape from secret-like prefixes. No real token was used.
