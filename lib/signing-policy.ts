/**
 * Authorization gate for the real wallet key. The allowlist does not select
 * a different key or address. It only skips a fresh passkey or Face ID check.
 */
const IMMEDIATE_TARGETS = new Set([
  'social_graph::follow',
  'social_graph::unfollow',
  'post::create_post',
  'post::like',
  'post::unlike',
  'post::like_post',
  'post::unlike_post',
  'post::comment',
  'post::repost',
])

export function moveFunction(target: string): string {
  const parts = target.split('::').filter(Boolean)
  if (parts.length < 2) return target.trim()
  return `${parts[parts.length - 2]}::${parts[parts.length - 1]}`
}

/** True when this Move target must prompt before the real wallet key signs. */
export function requiresFreshAuthorization(moveTarget: string): boolean {
  return !IMMEDIATE_TARGETS.has(moveFunction(moveTarget))
}
