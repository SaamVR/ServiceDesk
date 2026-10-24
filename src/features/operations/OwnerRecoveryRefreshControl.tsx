"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./OwnerQuoteRecoveryQueue.module.css";

/** Operator-controlled fresh server read. router.refresh() re-evaluates the
 * existing session/owner/branch source reader: no custom API, source event
 * replay, worker activation, or optimistic claim of successful processing.
 */
export function OwnerRecoveryRefreshControl() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button className={styles.refresh} type="button" disabled={pending}
      aria-busy={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? "Rechecking saved source…" : "Recheck saved counts"}
    </button>
  );
}
