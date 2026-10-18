# R40 AI mixed-turn tool quarantine

Operational bug: a model could request a blocked financial tool alongside a benign facade proposal. The orchestration correctly marked the turn `handoverRequired`, but still included the other tools in the saved draft. A downstream integration might interpret them as actionable despite the handover flag. For any handover condition (unsafe reply, blocked tool, explicit human review, prompt-injection/scope risk), this patch replaces the full model tool list with a single `requestHumanReview` proposal. Safe non-handover tools are unchanged.

No automatic tool execution, provider delivery, customer sends or payment authority is granted. Source tests cover mixed tool sets, safety risk, unsafe reply and explicit human review. Future tool execution remains behind ServiceDesk facade and owner permissions.
