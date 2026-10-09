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
