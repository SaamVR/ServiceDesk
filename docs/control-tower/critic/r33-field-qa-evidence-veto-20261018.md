# L14 field QA critic — forged photo reference veto

Owner review source may include a mediaReference whose objectRef or storageProvider is only whitespace, or whose objectRef is overly long. Such references are not proof of a stored image and must not satisfy the BEFORE/AFTER evidence count. Require bounded, nonblank provider and object reference at input validation, with human QA review still mandatory. The check does not fetch the media or inspect actual contents.
