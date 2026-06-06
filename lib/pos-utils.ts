export function formatCop(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(value);
}

export function getTodayKey(date = new Date()) {
  return date.toLocaleDateString("sv-SE", { timeZone: "America/Bogota" });
}

export function getBogotaDayRange(date = new Date()) {
  const formatted = getTodayKey(date);
  const [year, month, day] = formatted.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0, 0));

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

function getBogotaDateParts(date = new Date()) {
  const [year, month, day] = getTodayKey(date).split("-").map(Number);

  return { year, month, day };
}

function makeBogotaUtcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));
}

export function getBogotaPeriodRange(period: "today" | "week" | "month", date = new Date()) {
  const { year, month, day } = getBogotaDateParts(date);
  const todayStart = makeBogotaUtcDate(year, month, day);

  if (period === "today") {
    const tomorrowStart = makeBogotaUtcDate(year, month, day + 1);

    return {
      startIso: todayStart.toISOString(),
      endIso: tomorrowStart.toISOString()
    };
  }

  if (period === "week") {
    const jsDay = new Date(todayStart.getTime()).getUTCDay();
    const distanceFromMonday = jsDay === 0 ? 6 : jsDay - 1;
    const start = makeBogotaUtcDate(year, month, day - distanceFromMonday);
    const end = makeBogotaUtcDate(year, month, day - distanceFromMonday + 7);

    return {
      startIso: start.toISOString(),
      endIso: end.toISOString()
    };
  }

  const start = makeBogotaUtcDate(year, month, 1);
  const end = makeBogotaUtcDate(year, month + 1, 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

export function getBogotaSalesRange(
  period: "day" | "week" | "month" | "year",
  date = new Date()
) {
  if (period === "day") {
    return getBogotaPeriodRange("today", date);
  }

  if (period === "week") {
    return getBogotaPeriodRange("week", date);
  }

  if (period === "month") {
    return getBogotaPeriodRange("month", date);
  }

  const { year } = getBogotaDateParts(date);
  const start = makeBogotaUtcDate(year, 1, 1);
  const end = makeBogotaUtcDate(year + 1, 1, 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

export function getBogotaCustomRange(startDate: string, endDate: string) {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  const start = makeBogotaUtcDate(startYear, startMonth, startDay);
  const end = makeBogotaUtcDate(endYear, endMonth, endDay + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

export function formatSaleTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "America/Bogota"
  }).format(new Date(value));
}
