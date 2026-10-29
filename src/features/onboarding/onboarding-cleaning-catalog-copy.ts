/** Counts distinct quote-engine-supported active cleaning types, not rows. */
export function countDistinctSupportedCleaningTypes(
  catalog?: readonly { active: boolean; code: string }[],
): number {
  if (!catalog) return 0;
  return new Set(catalog.filter(item => item.active &&
    (item.code === "STANDARD" || item.code === "DEEP" || item.code === "MOVE_OUT"))
    .map(item => item.code)).size;
}

/** Safe owner-facing explanation based only on the active saved catalog. */
export function describeSavedCleaningCatalog(
  activeCatalogItems: number,
  activeSupportedCleaningTypes: number,
): string {
  if (!Number.isSafeInteger(activeCatalogItems) || activeCatalogItems < 0 ||
      !Number.isSafeInteger(activeSupportedCleaningTypes) ||
      activeSupportedCleaningTypes < 0 ||
      activeSupportedCleaningTypes > activeCatalogItems ||
      activeSupportedCleaningTypes > 3) {
    return "Saved cleaning catalog counts could not be verified. Refresh Settings before quoting.";
  }
  if (activeSupportedCleaningTypes === 0) {
    return activeCatalogItems === 0
      ? "No active Standard, Deep or Move-Out cleaning service is saved. Configure the supported cleaning catalog and actual owner-entered rates."
      : `No active Standard, Deep or Move-Out cleaning service is saved. ${activeCatalogItems} other active catalog item${activeCatalogItems === 1 ? "" : "s"} cannot authorize cleaning quotes. Configure supported services and actual owner-entered rates.`;
  }
  return `${activeSupportedCleaningTypes} supported active cleaning service type${activeSupportedCleaningTypes === 1 ? "" : "s"} verified from the saved catalog. ${activeCatalogItems} active catalog item${activeCatalogItems === 1 ? "" : "s"} recorded in total. Saved branch pricing must be verified separately before quoting.`;
}
