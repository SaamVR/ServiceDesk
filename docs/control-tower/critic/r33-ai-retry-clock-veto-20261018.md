# L14 independent critic — retry timestamp civil-validity veto

A regular-expression zoned string plus Date.parse does not prove the calendar date is real (JavaScript can normalize February 30), nor enforce timezone offset bounds. A model failure recovery must never schedule retried provider inference from fabricated/normalized clocks. This test challenges impossible date and out-of-range +/- offsets; owner of AI recovery module must validate civil fields and original UTC offset before integration. No provider request or business state mutation is performed.
