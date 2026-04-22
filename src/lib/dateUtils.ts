import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

export const DATE_TIME_CONFIG = {
  timezone: "America/Sao_Paulo",
  dateFormat: "dd/MM/yyyy",
  timeFormat: "HH:mm",
  dateTimeFormat: "dd/MM/yyyy HH:mm",
  dateTimeLongFormat: "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
  locale: ptBR,
} as const;

export function toSaoPauloTime(date: Date | string): Date {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return toZonedTime(dateObj, DATE_TIME_CONFIG.timezone);
}

export function formatDate(date: Date | string): string {
  try {
    const zonedDate = toSaoPauloTime(date);
    return format(zonedDate, DATE_TIME_CONFIG.dateFormat, { locale: DATE_TIME_CONFIG.locale });
  } catch {
    return typeof date === "string" ? date : "";
  }
}

export function formatTime(date: Date | string): string {
  try {
    const zonedDate = toSaoPauloTime(date);
    return format(zonedDate, DATE_TIME_CONFIG.timeFormat, { locale: DATE_TIME_CONFIG.locale });
  } catch {
    return typeof date === "string" ? date : "";
  }
}

export function formatDateTime(date: Date | string): string {
  try {
    const zonedDate = toSaoPauloTime(date);
    return format(zonedDate, DATE_TIME_CONFIG.dateTimeFormat, { locale: DATE_TIME_CONFIG.locale });
  } catch {
    return typeof date === "string" ? date : "";
  }
}

export function formatDateTimeLong(date: Date | string): string {
  try {
    const zonedDate = toSaoPauloTime(date);
    return format(zonedDate, DATE_TIME_CONFIG.dateTimeLongFormat, { locale: DATE_TIME_CONFIG.locale });
  } catch {
    return typeof date === "string" ? date : "";
  }
}

export function formatCustom(date: Date | string, formatStr: string): string {
  try {
    const zonedDate = toSaoPauloTime(date);
    return format(zonedDate, formatStr, { locale: DATE_TIME_CONFIG.locale });
  } catch {
    return typeof date === "string" ? date : "";
  }
}

export function nowInSaoPaulo(): Date {
  return toSaoPauloTime(new Date());
}

export function nowInSaoPauloForInput(): string {
  const zonedDate = toSaoPauloTime(new Date());
  return format(zonedDate, "yyyy-MM-dd'T'HH:mm");
}

export function formatMonthYear(date: Date | string): string {
  try {
    const zonedDate = toSaoPauloTime(date);
    return format(zonedDate, "MMMM 'de' yyyy", { locale: DATE_TIME_CONFIG.locale });
  } catch {
    return typeof date === "string" ? date : "";
  }
}