// Minutes to add to a UTC instant to get its America/New_York wall-clock time.
// EST → -300, EDT → -240.
function nyOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const o: Record<string, string> = {}
  for (const p of parts) o[p.type] = p.value
  const nyAsUtc = Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second)
  return Math.round((nyAsUtc - date.getTime()) / 60000)
}

// UTC instant for the most recent 00:00 America/New_York. Used to bound
// "today's" trades — DST-safe because we resolve the offset at NY-midnight.
export function etTodayStartUtc(now: Date = new Date()): Date {
  const offNow = nyOffsetMinutes(now)
  const nyNow = new Date(now.getTime() + offNow * 60000)
  const y = nyNow.getUTCFullYear()
  const m = nyNow.getUTCMonth()
  const d = nyNow.getUTCDate()
  const naiveMidnightUtc = Date.UTC(y, m, d, 0, 0, 0)
  const offAtMidnight = nyOffsetMinutes(new Date(naiveMidnightUtc))
  return new Date(naiveMidnightUtc - offAtMidnight * 60000)
}
