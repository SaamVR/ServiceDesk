# Independent L14 critic — forged AI workflow model result envelope

An AI orchestration service that accepts `Object.keys(value.output).length === 0` without requiring a plain exact empty object can wrongly treat an empty string/array/number or foreign prototype object as an authorized zero-extraction response, then surface an apparently verified workflow suggestion. This regression corpus enforces exact empty plain output, no tools or citations, owner + branch second-read. Test must be merged into candidate after producer repair. No live provider call or business mutation.
