const DEFAULT_TIME_ZONE = 'Africa/Cairo';

function pad(value) {
  return String(value).padStart(2, '0');
}

function getTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
}

function getDateTimeParts(date = new Date(), timeZone = getTimeZone()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]).filter(([type]) => type !== 'literal'));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    timeZone,
  };
}

export function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getCurrentDateInfo(timeZone = getTimeZone()) {
  const parts = getDateTimeParts(new Date(), timeZone);
  return {
    currentDate: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    timeZone: parts.timeZone,
  };
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export function resolveDateRange({ period, from, to, timeZone = getTimeZone() }) {
  if (period) {
    const now = getDateTimeParts(new Date(), timeZone);
    switch (period) {
      case 'today':
        return { from: `${now.year}-${pad(now.month)}-${pad(now.day)}`, to: `${now.year}-${pad(now.month)}-${pad(now.day)}` };
      case 'yesterday': {
        const yesterday = new Date(`${now.year}-${pad(now.month)}-${pad(now.day)}T00:00:00`);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          from: formatDate(yesterday),
          to: formatDate(yesterday),
        };
      }
      case 'current_week': {
        const date = new Date(`${now.year}-${pad(now.month)}-${pad(now.day)}T00:00:00`);
        const weekDay = date.getDay();
        const monday = new Date(date);
        monday.setDate(date.getDate() - ((weekDay + 6) % 7));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return { from: formatDate(monday), to: formatDate(sunday) };
      }
      case 'current_month': {
        const firstDay = `${now.year}-${pad(now.month)}-01`;
        const lastDay = `${now.year}-${pad(now.month)}-${pad(daysInMonth(now.year, now.month))}`;
        return { from: firstDay, to: lastDay };
      }
      case 'current_year': {
        return { from: `${now.year}-01-01`, to: `${now.year}-12-31` };
      }
      default:
        throw new Error(`Unsupported relative period: ${period}`);
    }
  }

  return { from, to };
}
