import { DomainError } from "./errors.js";
import { parseIsoDate } from "./dates.js";
import { mergeSort } from "./sorting.js";

function requireRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new DomainError(`${label} must be an object`, "VALIDATION");
  }
}

function requireSummaries(summaries) {
  if (!Array.isArray(summaries)) {
    throw new DomainError("Event summaries must be an array", "VALIDATION");
  }

  for (const summary of summaries) {
    requireRecord(summary, "Event summary");
    if (
      typeof summary.id !== "string" ||
      typeof summary.title !== "string" ||
      typeof summary.city !== "string" ||
      typeof summary.venue !== "string"
    ) {
      throw new DomainError("Event summaries need string id, title, city, and venue fields", "VALIDATION");
    }
    parseIsoDate(summary.date, "Event date");
    if (!Array.isArray(summary.tiers)) {
      throw new DomainError("Event summaries need a tiers array", "VALIDATION");
    }
    for (const tier of summary.tiers) {
      requireRecord(tier, "Ticket tier");
      if (!Number.isSafeInteger(tier.priceCents) || tier.priceCents < 0) {
        throw new DomainError("Tier price must be a non-negative whole number of cents", "VALIDATION");
      }
      if (!Number.isSafeInteger(tier.available) || tier.available < 0) {
        throw new DomainError("Tier availability must be a non-negative whole number", "VALIDATION");
      }
    }
  }
}

function optionalText(value, label) {
  if (value !== undefined && typeof value !== "string") {
    throw new DomainError(`${label} must be a string`, "VALIDATION");
  }
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareTitles(left, right) {
  const titleOrder = compareText(left.title.toLowerCase(), right.title.toLowerCase());
  return titleOrder || compareText(left.id, right.id);
}

function cheapestPrice(summary) {
  if (summary.tiers.length === 0) {
    return undefined;
  }
  let cheapest = summary.tiers[0].priceCents;
  for (let index = 1; index < summary.tiers.length; index += 1) {
    if (summary.tiers[index].priceCents < cheapest) {
      cheapest = summary.tiers[index].priceCents;
    }
  }
  return cheapest;
}

function availableSeats(summary) {
  let total = 0n;
  for (const tier of summary.tiers) {
    total += BigInt(tier.available);
  }
  return total;
}

export function filterEvents(summaries, criteria = {}) {
  requireSummaries(summaries);
  requireRecord(criteria, "Search criteria");
  const { q, city, from, to, maxPriceCents, onlyAvailable } = criteria;
  optionalText(q, "Search query");
  optionalText(city, "City");

  const fromDate = from === undefined ? undefined : parseIsoDate(from, "From date");
  const toDate = to === undefined ? undefined : parseIsoDate(to, "To date");
  if (maxPriceCents !== undefined && (!Number.isSafeInteger(maxPriceCents) || maxPriceCents < 0)) {
    throw new DomainError("Maximum price must be a non-negative whole number of cents", "VALIDATION");
  }
  if (onlyAvailable !== undefined && typeof onlyAvailable !== "boolean") {
    throw new DomainError("onlyAvailable must be a boolean", "VALIDATION");
  }

  const query = q?.trim().toLowerCase();
  const requestedCity = city?.trim().toLowerCase();

  return summaries.filter((summary) => {
    if (query && !summary.title.toLowerCase().includes(query) && !summary.venue.toLowerCase().includes(query)) {
      return false;
    }
    if (requestedCity && summary.city.toLowerCase() !== requestedCity) {
      return false;
    }

    const eventDate = parseIsoDate(summary.date, "Event date");
    if (fromDate && (fromDate.dateOnly
      ? eventDate.calendarDate < fromDate.calendarDate
      : eventDate.timestamp < fromDate.timestamp)) {
      return false;
    }
    if (toDate && (toDate.dateOnly
      ? eventDate.calendarDate > toDate.calendarDate
      : eventDate.timestamp > toDate.timestamp)) {
      return false;
    }

    if (maxPriceCents !== undefined) {
      const price = cheapestPrice(summary);
      if (price === undefined || price > maxPriceCents) {
        return false;
      }
    }
    if (onlyAvailable && availableSeats(summary) === 0n) {
      return false;
    }
    return true;
  });
}

export function sortEvents(summaries, sortBy) {
  requireSummaries(summaries);
  if (!["date", "price", "availability"].includes(sortBy)) {
    throw new DomainError(`Unknown event sort option: ${sortBy}`, "VALIDATION");
  }

  const comparator = (left, right) => {
    let order = 0;
    if (sortBy === "date") {
      order = left.date.slice(0, 10) < right.date.slice(0, 10)
        ? -1
        : left.date.slice(0, 10) > right.date.slice(0, 10)
          ? 1
          : 0;
    } else if (sortBy === "price") {
      const leftPrice = cheapestPrice(left);
      const rightPrice = cheapestPrice(right);
      if (leftPrice === undefined && rightPrice !== undefined) return 1;
      if (rightPrice === undefined && leftPrice !== undefined) return -1;
      if (leftPrice !== undefined && rightPrice !== undefined) {
        order = leftPrice - rightPrice;
      }
    } else {
      const leftSeats = availableSeats(left);
      const rightSeats = availableSeats(right);
      order = leftSeats > rightSeats ? -1 : leftSeats < rightSeats ? 1 : 0;
    }
    return order || compareTitles(left, right);
  };

  return mergeSort(summaries, comparator);
}

export function searchEvents(summaries, criteria, sortBy) {
  return sortEvents(filterEvents(summaries, criteria), sortBy);
}
