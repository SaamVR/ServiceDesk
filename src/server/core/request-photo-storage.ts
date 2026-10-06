export interface SupabasePhotoStorageRef {
  bucket: string;
  objectPath: string;
}

const bucketPattern = /^[a-z0-9][a-z0-9_-]{1,62}$/i;

export function parseSupabasePhotoStorageRef(value: string): SupabasePhotoStorageRef | undefined {
  const match = /^supabase:\/\/([^/]+)\/(.+)$/.exec(value.trim());
  if (!match) return undefined;
  const bucket = match[1];
  const objectPath = match[2];
  if (!bucketPattern.test(bucket)) return undefined;
  if (!objectPath || objectPath.startsWith("/") || objectPath.includes("\\") || objectPath.split("/").some((part) => part === ".." || part.length === 0)) {
    return undefined;
  }
  if (objectPath.length > 400) return undefined;
  return { bucket, objectPath };
}
