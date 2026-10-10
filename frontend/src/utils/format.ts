const dateTimeFormat = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const dateFormat = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' });

export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));
export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

export const shortId = (id: string) => id.slice(0, 8);

/** Date input value (yyyy-mm-dd) to the start or end of that day in UTC, as the audit API expects. */
export const dayBoundaryToIso = (date: string, boundary: 'start' | 'end') =>
  `${date}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`;

export const fullName = (user: { firstName: string; lastName: string }) =>
  `${user.firstName} ${user.lastName}`;

const relativeFormat = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** "hace 5 minutos", "ayer"… relative to `now`; anything under a minute reads as "ahora". */
export const formatRelativeTime = (iso: string, now = Date.now()): string => {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const [unit, size] = RELATIVE_UNITS.find(([, unitSeconds]) => Math.abs(seconds) >= unitSeconds) ?? [
    'second',
    1,
  ];
  return unit === 'second' ? 'ahora' : relativeFormat.format(Math.round(seconds / size), unit);
};
