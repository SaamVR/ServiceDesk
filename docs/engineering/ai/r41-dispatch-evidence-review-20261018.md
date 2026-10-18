# R41 AI-D — dispatch recommendation without false AI booking authority

A read-only AI-assisted dispatcher review composes the existing crew ranking model with strict staff role, same-tenant saved snapshot and calendar/skills checks. Only fully verified, non-overlapping crew windows with skill evidence can appear as recommendations. A high-confidence candidate remains HUMAN APPROVAL REQUIRED and availability is *never confirmed*; route optimization is explicitly NOT SCORED. Partial source pages, unknown crew assignments, invalid Gregorian dates and foreign teams fail closed.

This module does not itself load tenant data, contact a customer, reserve crew capacity or mutate a visit. Source must come from an authorized complete server read; UI hookup and version-checked dispatch command remain separate product work. Real staffing availability and travel ETA are not established from synthetic tests.
