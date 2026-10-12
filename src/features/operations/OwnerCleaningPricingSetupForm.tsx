import { randomUUID } from "node:crypto";
import { StaffSubmitButton } from "@/components/product/StaffSubmitButton";
import { OwnerCleaningPricingWorksheet } from "./OwnerCleaningPricingWorksheet";
import type { OperationalBranchScope } from "./operational-product-runtime";
import { availableFirstRunUsdBranches, type OwnerPricingBookProof } from "./owner-pricing-readiness";

type PriceService = {
  label: string;
  prefix: string;
  nameField: string;
  defaultName: string;
  oven?: boolean;
};
const services: readonly PriceService[] = [
  { label: "Standard clean", prefix: "standard", nameField: "nameStandard", defaultName: "Standard cleaning" },
  { label: "Deep clean", prefix: "deep", nameField: "nameDeep", defaultName: "Deep cleaning" },
  { label: "Move-out clean", prefix: "moveOut", nameField: "nameMoveOut", defaultName: "Move-out cleaning", oven: true },
];

function MoneyField({ label, name }: { label: string; name: string }) {
  return (
    <label style={{ display: "grid", gap: 5, fontSize: ".82rem" }}>
      <span>{label} ($ USD)</span>
      <input className="app-input" name={name} type="text" inputMode="decimal"
        placeholder="Enter actual price" pattern="(0|[1-9][0-9]{0,5})(\\.[0-9]{1,2})?"
        maxLength={10} required />
    </label>
  );
}
function MinutesField({ label, name }: { label: string; name: string }) {
  return (
    <label style={{ display: "grid", gap: 5, fontSize: ".82rem" }}>
      <span>{label} (minutes)</span>
      <input className="app-input" name={name} type="number" min={0} max={1440} step={1}
        placeholder="Minutes" required />
    </label>
  );
}

/** No monetary preset is ever supplied: the owner must enter real prices. */
export function OwnerCleaningPricingSetupForm({
  scope,
  proof,
  action,
}: {
  scope?: OperationalBranchScope;
  proof?: OwnerPricingBookProof;
  action: (formData: FormData) => Promise<void>;
}) {
  const branches = availableFirstRunUsdBranches(scope, proof);
  if (branches.length === 0) return (
    <p role="status">Create or select an authorized USD cleaning branch before configuring pricing.</p>
  );
  const setupId = randomUUID();
  return (
    <section id="owner-first-run-pricing" aria-label="First-run owner cleaning pricing" style={{
      border: "1px solid #d1e8df", borderRadius: 14, scrollMarginTop: 112,
      padding: 20, background: "#fff",
      display: "grid", gap: 16, marginTop: 16,
    }}>
      <header>
        <h4 style={{ margin: "0 0 7px", color: "#174a43" }}>Activate real cleaning services and prices</h4>
        <p style={{ margin: 0, fontSize: ".85rem", lineHeight: 1.6 }}>
          Owner-only initial setup. Enter your business’s actual prices in USD; no sandbox,
          sample or suggested prices are activated. A saved rate card is permanent and
          first-run setup cannot overwrite an existing branch price book.
          Nothing is sent to customers or charged.
        </p>
      </header>
      <form action={action} style={{ display: "grid", gap: 18 }}>
        <input type="hidden" name="setupId" value={setupId} />
        <input type="hidden" name="currency" value="USD" />
        <label style={{ display: "grid", gap: 6 }}>
          <strong>Cleaning branch</strong>
          <select className="app-input" name="branchId" required defaultValue={branches[0]?.id}>
            {branches.map(branch => <option key={branch.id} value={branch.id}>
              {branch.name} · {branch.code} · USD
            </option>)}
          </select>
        </label>
        {services.map(service => (
          <fieldset key={service.prefix} style={{
            display: "grid", gap: 12, border: "1px solid #e2eeea",
            borderRadius: 12, padding: 16, minWidth: 0,
          }}>
            <legend style={{ fontWeight: 750, color: "#215449" }}>{service.label}</legend>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Customer-facing service name</span>
              <input className="app-input" name={service.nameField} type="text"
                defaultValue={service.defaultName} minLength={3} maxLength={120} required />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <MoneyField label="Base service price" name={service.prefix + "Base"} />
              <MinutesField label="Base service time" name={service.prefix + "BaseMinutes"} />
              <MoneyField label="Price per bedroom" name={service.prefix + "Bedroom"} />
              <MinutesField label="Time per bedroom" name={service.prefix + "BedroomMinutes"} />
              <MoneyField label="Price per bathroom" name={service.prefix + "Bathroom"} />
              <MinutesField label="Time per bathroom" name={service.prefix + "BathroomMinutes"} />
              {service.oven ? <>
                <MoneyField label="Oven add-on" name={service.prefix + "Oven"} />
                <MinutesField label="Oven time" name={service.prefix + "OvenMinutes"} />
              </> : null}
            </div>
          </fieldset>
        ))}
        <fieldset style={{ display: "grid", gap: 12, border: "1px solid #e2eeea", borderRadius: 12, padding: 16 }}>
          <legend style={{ fontWeight: 750 }}>Quote and deposit policy</legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>Deposit percent
              <input className="app-input" name="depositPercent" type="number" min={0} max={100} step={1} required />
            </label>
            <label style={{ display: "grid", gap: 6 }}>Quote valid for (hours)
              <input className="app-input" name="validHours" type="number" min={1} max={720} step={1} required />
            </label>
            <label style={{ display: "grid", gap: 6 }}>Crew buffer (minutes)
              <input className="app-input" name="bufferMinutes" type="number" min={0} max={1440} step={1} required />
            </label>
            <MoneyField label="Max quote eligible for automatic approval" name="autoApprovalMax" />
          </div>
        </fieldset>
        <OwnerCleaningPricingWorksheet />
        <StaffSubmitButton className="app-button-primary" style={{ justifySelf: "start" }}
          pendingLabel="Saving pricing…">
          Save verified first-run pricing
        </StaffSubmitButton>
        <p style={{ fontSize: ".78rem", margin: 0 }}>
          Pricing activation is transactional and requires a verified owner session, protected backend
          and deployed database migration. On failure, no successful setup is claimed.
        </p>
      </form>
    </section>
  );
}
