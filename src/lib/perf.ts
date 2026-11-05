/**
 * Performance guards for list/transition smoothness.
 *
 * Long lists (e.g. complaints, departments, rewards) often apply a per-item
 * entrance delay of `index * step`. With many items — common once a city has
 * lots of Hindi complaints — the cumulative delay grows unbounded, animations
 * run far down the list while the user scrolls, and low-powered mobile devices
 * stutter because dozens of motion elements stay "animating" at once.
 *
 * `cappedStagger` clamps the cumulative delay so only the first items stagger
 * and everything past the cap appears immediately, keeping scroll + transitions
 * smooth regardless of list length or script (Devanagari renders identically).
 */
export function cappedStagger(index: number, step = 0.04, cap = 0.4): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  return Math.min(index * step, cap);
}
