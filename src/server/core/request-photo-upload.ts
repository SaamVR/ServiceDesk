import type { Result } from "../../contracts";

export const REQUEST_PHOTO_MAX_BYTES = 20 * 1024 * 1024;

export type SupportedRequestPhotoType = "image/jpeg" | "image/png" | "image/webp";

export interface ValidatedRequestPhoto {
  mediaType: SupportedRequestPhotoType;
  extension: "jpg" | "png" | "webp";
  bytes: Uint8Array;
}

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function detectedType(bytes: Uint8Array): SupportedRequestPhotoType | undefined {
  if (
    bytes.length >= 3
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff
  ) return "image/jpeg";
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) return "image/png";
  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  return undefined;
}

export function validateRequestPhotoBytes(input: {
  declaredType: string;
  bytes: Uint8Array;
}): Result<ValidatedRequestPhoto> {
  if (input.bytes.byteLength < 12 || input.bytes.byteLength > REQUEST_PHOTO_MAX_BYTES) {
    return fail("REQUEST_PHOTO_SIZE_INVALID", "Photo must be no larger than 20 MiB.");
  }
  const detected = detectedType(input.bytes);
  if (!detected || detected !== input.declaredType) {
    return fail("REQUEST_PHOTO_TYPE_INVALID", "Photo content does not match a supported JPEG, PNG, or WebP image.");
  }
  return {
    ok: true,
    value: {
      mediaType: detected,
      extension: detected === "image/jpeg" ? "jpg" : detected === "image/png" ? "png" : "webp",
      bytes: input.bytes,
    },
  };
}

export function requestPhotoRetentionDays(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 90) return 30;
  return parsed;
}

export function requestPhotoObjectPath(input: {
  workspaceId: string;
  requestId: string;
  assetToken: string;
  extension: ValidatedRequestPhoto["extension"];
}): string {
  const safe = /^[a-zA-Z0-9-]{8,80}$/;
  if (!safe.test(input.workspaceId) || !safe.test(input.requestId) || !safe.test(input.assetToken)) {
    throw new Error("Request photo storage scope is malformed.");
  }
  return `${input.workspaceId}/${input.requestId}/${input.assetToken}.${input.extension}`;
}
