/**
 * Same rule as `kayamo_logical_date` in Postgres: shift local time back by
 * day_starts_at, then take the calendar date in the user's timezone.
 */
export function logicalDateFromInstant(
  instantIso: string,
  timeZone = 'Asia/Manila',
  dayStartsAt = '00:00:00',
): string {
  const instant = new Date(instantIso);
  const local = localParts(instant, timeZone);
  const [startHour, startMinute, startSecond] = parseDayStartsAt(dayStartsAt);
  const localMs = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  const shifted = localMs - ((startHour * 60 + startMinute) * 60 + startSecond) * 1000;
  const shiftedDate = new Date(shifted);
  return `${shiftedDate.getUTCFullYear()}-${pad(shiftedDate.getUTCMonth() + 1)}-${pad(shiftedDate.getUTCDate())}`;
}

function parseDayStartsAt(value: string): [number, number, number] {
  const [h = '0', m = '0', s = '0'] = value.split(':');
  return [Number(h), Number(m), Number(s)];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function localParts(instant: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const bag = Object.fromEntries(
    fmt.formatToParts(instant).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}
