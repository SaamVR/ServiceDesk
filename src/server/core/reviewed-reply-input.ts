/** Staff confirmation is not permission to send arbitrary-size or spoofed
 * transport content. Keep manual replies bounded before database/provider work.
 * Natural paragraph breaks and tabs remain supported for human replies.
 */
export function verifiedReviewedReplyBody(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 4_000 ||
      value.trim().length === 0 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value) ||
      /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u.test(value)) return false;
  return true;
}
