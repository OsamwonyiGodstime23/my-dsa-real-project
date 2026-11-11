import { DomainError } from "./errors.js";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;

function isValidCalendarDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysPerMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysPerMonth[month - 1];
}

export function parseIsoDate(value, label = "Date") {
  if (typeof value !== "string") {
    throw new DomainError(`${label} must be an ISO date string`, "VALIDATION");
  }

  const match = DATE_PATTERN.exec(value) ?? DATE_TIME_PATTERN.exec(value);
  if (!match) {
    throw new DomainError(`${label} must be an ISO date string`, "VALIDATION");
  }

  const [, yearText, monthText, dayText] = match;
  if (!isValidCalendarDate(Number(yearText), Number(monthText), Number(dayText))) {
    throw new DomainError(`${label} must be a real calendar date`, "VALIDATION");
  }
  const offset = /[+-](\d{2}):(\d{2})$/.exec(value);
  if (offset && Number(offset[1]) === 14 && Number(offset[2]) !== 0) {
    throw new DomainError(`${label} must have a valid ISO timezone offset`, "VALIDATION");
  }

  const timestamp = Date.parse(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (!Number.isFinite(timestamp)) {
    throw new DomainError(`${label} must be a valid ISO date`, "VALIDATION");
  }

  return {
    timestamp,
    dateOnly: value.length === 10,
    calendarDate: value.slice(0, 10)
  };
}
