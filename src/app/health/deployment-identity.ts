/**
 * Public, non-secret commit provenance supplied by the hosting platform.
 * Never accept an arbitrary browser parameter or operator self-attestation.
 * An invalid or conflicting host claim fails closed to unavailable evidence.
 */
export type DeploymentIdentity = {
  sourceSha: string;
  sourceProvider: "render" | "vercel" | "both";
};

export function verifiedHostingCommitIdentity(
  env: Readonly<Record<string, string | undefined>>,
): DeploymentIdentity | undefined {
  const render = env.RENDER_GIT_COMMIT;
  const vercel = env.VERCEL_GIT_COMMIT_SHA;
  const supplied = [render, vercel].filter((sha): sha is string => sha !== undefined);
  if (!supplied.length ||
      supplied.some(sha => !/^[a-f0-9]{40}$/i.test(sha)) ||
      (supplied.length === 2 && supplied[0].toLowerCase() !== supplied[1].toLowerCase())) {
    return undefined;
  }
  return {
    sourceSha: supplied[0].toLowerCase(),
    sourceProvider: render !== undefined && vercel !== undefined
      ? "both" : render !== undefined ? "render" : "vercel",
  };
}
