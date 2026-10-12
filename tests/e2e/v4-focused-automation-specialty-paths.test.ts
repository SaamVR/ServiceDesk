import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const read = (file:string) => readFileSync(join(process.cwd(), ".github/workflows", file), "utf8");
const specialists = [
  "v4-automation-rule-capacity-rc.yml",
  "v4-multievent-automation-rc.yml",
  "v4-attention-exception-automation-rc.yml",
  "v4-automation-27-playbooks-rc.yml",
];

describe("V4 focused automation PR CI with mandatory whole-product source proof",()=>{
  it("triggers all specialist domain checks on workflow engine, migrations, contracts and tests",()=>{
    for(const file of specialists){
      const workflow=read(file);
      expect(workflow).toContain("pull_request:");
      expect(workflow).toContain("feat/servicedesk-v4-reconciled-qa-shell-20261012");
      expect(workflow).toContain("    paths:");
      expect(workflow).toContain('".github/workflows/'+file+'"');
      expect(workflow).toContain('"src/server/workflows/**"');
      expect(workflow).toContain('"src/contracts/workflow*.ts"');
      expect(workflow).toContain('"supabase/migrations/*workflow*.sql"');
      expect(workflow).toContain('"tests/db/v4-*automation*.test.ts"');
      expect(workflow).toContain("pnpm exec vitest run");
      expect(workflow).toContain("if: github.event_name == 'push'");
      expect(workflow).not.toContain("paths-ignore:");
    }
  });
  it("does not weaken mandatory exact PR-head full source or post-merge browser proof",()=>{
    const full=read("v4-controller-pr-full-source-rc.yml");
    expect(full).toContain("pull_request:");
    expect(full).toContain("pnpm check:rc");
    expect(full).toContain("github.event.pull_request.head.sha");
    expect(full).not.toContain("    paths:");
    const release=read("v4-reconciled-full-rc.yml");
    expect(release).toContain("Real HTTP guest-route release contract (all 13 modules)");
    expect(release).toContain("Real Chrome synthetic operations journey");
    expect(release).toContain("pnpm check:rc");
  });
});
