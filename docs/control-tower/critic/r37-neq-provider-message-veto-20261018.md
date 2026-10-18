# Independent Critic L23 — false external-send action from an array NEQ fact

The core R37 rule evaluator vulnerability impacts more than internal attention:
a QUOTE_ACCEPTED rule using `quote.currency NEQ USD` could previously match a
multi-valued event (including USD), then prepare an external email action
requiring approval. While owner approval remains mandatory, false eligibility
pollutes customer workflows and decision evidence.

This separate critic branch verifies a valid scalar still reaches approval,
while USD/EUR arrays and absent source evidence never create any action plan.
Not proof of provider email delivery or commercial authorization.
