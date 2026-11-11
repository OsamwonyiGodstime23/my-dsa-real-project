import { DomainError } from "./errors.js";
import { newId, newReference } from "./ids.js";
import { Queue } from "./waitlistQueue.js";
import { parseIsoDate } from "./dates.js";

function requireStore(store) {
  if (
    store === null ||
    typeof store !== "object" ||
    !(store.events instanceof Map) ||
    !Array.isArray(store.bookings) ||
    !(store.bookingsByReference instanceof Map) ||
    !(store.waitlists instanceof Map)
  ) {
    throw new DomainError("A valid store is required", "VALIDATION");
  }
}

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DomainError(`${label} must be a non-empty string`, "VALIDATION");
  }
  return value.trim();
}

function requireRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new DomainError(`${label} must be an object`, "VALIDATION");
  }
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomainError(`${label} must be a positive whole number`, "VALIDATION");
  }
}

function requireEvent(store, eventId) {
  requireText(eventId, "Event id");
  const event = store.events.get(eventId);
  if (!event) {
    throw new DomainError(`Event ${eventId} was not found`, "NOT_FOUND");
  }
  return event;
}

function requireTier(event, tierId) {
  requireText(tierId, "Tier id");
  const tier = event.tiers.get(tierId);
  if (!tier) {
    throw new DomainError(`Tier ${tierId} was not found`, "NOT_FOUND");
  }
  return tier;
}

function getWaitlist(store, eventId, tierId, createIfMissing = false) {
  const key = `${eventId}:${tierId}`;
  let queue = store.waitlists.get(key);
  if (!queue && createIfMissing) {
    queue = new Queue();
    store.waitlists.set(key, queue);
  }
  return queue;
}

export function createStore() {
  return {
    events: new Map(),
    bookings: [],
    bookingsByReference: new Map(),
    waitlists: new Map()
  };
}

export function createEvent(store, input) {
  requireStore(store);
  requireRecord(input, "Event");
  const title = requireText(input.title, "Event title");
  const city = requireText(input.city, "Event city");
  const venue = requireText(input.venue, "Event venue");
  const date = input.date;
  parseIsoDate(date, "Event date");
  const event = {
    id: newId(),
    title,
    name: title,
    city,
    venue,
    date,
    tiers: new Map(),
    published: false
  };

  store.events.set(event.id, event);
  return event;
}

export function addTier(store, eventId, input) {
  requireStore(store);
  const event = requireEvent(store, eventId);
  requireRecord(input, "Tier");
  const { name, priceCents, capacity } = input;
  const tierName = requireText(name, "Tier name");
  if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
    throw new DomainError("Price in cents must be a non-negative whole number", "VALIDATION");
  }
  requirePositiveInteger(capacity, "Tier capacity");

  const tier = {
    id: newId(),
    name: tierName,
    priceCents,
    capacity,
    sold: 0,
    available: capacity
  };
  event.tiers.set(tier.id, tier);
  return tier;
}

export function bookTickets(store, input) {
  requireStore(store);
  requireRecord(input, "Booking");
  const { eventId, tierId, attendeeName, quantity } = input;
  const event = requireEvent(store, eventId);
  if (!event.published) {
    throw new DomainError("Event must be published before tickets can be booked", "INVALID_STATE");
  }
  const tier = requireTier(event, tierId);
  const name = requireText(attendeeName, "Attendee name");
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new DomainError("Ticket quantity must be a whole number from 1 to 10", "VALIDATION");
  }
  if (quantity > tier.available) {
    throw new DomainError(
      `Only ${tier.available} tickets remain in ${tier.name}`,
      "SOLD_OUT"
    );
  }
  const totalCents = tier.priceCents * quantity;
  if (!Number.isSafeInteger(totalCents)) {
    throw new DomainError("Booking total exceeds the safe whole-cents range", "VALIDATION");
  }

  let reference;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    reference = newReference();
    if (!store.bookingsByReference.has(reference)) {
      break;
    }
    reference = undefined;
  }
  if (reference === undefined) {
    throw new DomainError("Could not generate a unique booking reference", "ID_GENERATION");
  }

  const booking = {
    id: newId(),
    reference,
    eventId: event.id,
    tierId: tier.id,
    attendeeName: name,
    quantity,
    totalCents,
    status: "pending"
  };

  tier.available -= quantity;
  tier.sold += quantity;
  store.bookings.push(booking);
  store.bookingsByReference.set(reference, booking);
  return booking;
}

export function cancelBooking(store, reference) {
  requireStore(store);
  const bookingReference = requireText(reference, "Booking reference");
  const booking = store.bookingsByReference.get(bookingReference);
  if (!booking) {
    throw new DomainError(`Booking ${bookingReference} was not found`, "NOT_FOUND");
  }
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    throw new DomainError("Booking has already been cancelled", "ALREADY_CANCELLED");
  }

  const event = requireEvent(store, booking.eventId);
  const tier = requireTier(event, booking.tierId);
  if (tier.available + booking.quantity > tier.capacity) {
    throw new DomainError("Cancelling this booking would exceed tier capacity", "CONFLICT");
  }

  tier.available += booking.quantity;
  tier.sold -= booking.quantity;
  booking.status = "cancelled";
  return booking;
}

export function findBookingByReference(store, reference) {
  requireStore(store);
  const bookingReference = requireText(reference, "Booking reference");
  const booking = store.bookingsByReference.get(bookingReference);
  if (!booking) {
    throw new DomainError(`Booking ${bookingReference} was not found`, "NOT_FOUND");
  }
  return booking;
}

export function joinWaitlist(store, input) {
  requireStore(store);
  requireRecord(input, "Waitlist entry");
  const { eventId, tierId, attendeeName } = input;
  const event = requireEvent(store, eventId);
  requireTier(event, tierId);
  const name = requireText(attendeeName, "Attendee name");
  const entry = {
    id: newId(),
    eventId,
    tierId,
    attendeeName: name
  };
  getWaitlist(store, eventId, tierId, true).enqueue(entry);
  return entry;
}

export function publishEvent(store, eventId) {
  requireStore(store);
  const event = requireEvent(store, eventId);
  if (event.tiers.size === 0) {
    throw new DomainError("An event needs at least one ticket tier before publishing", "INVALID_STATE");
  }
  event.published = true;
  return event;
}

export function unpublishEvent(store, eventId) {
  requireStore(store);
  const event = requireEvent(store, eventId);
  event.published = false;
  return event;
}

export function listEventSummaries(store, options = {}) {
  requireStore(store);
  requireRecord(options, "Event list options");
  const { publishedOnly = true } = options;
  if (typeof publishedOnly !== "boolean") {
    throw new DomainError("publishedOnly must be a boolean", "VALIDATION");
  }

  const summaries = [];
  for (const event of store.events.values()) {
    if (publishedOnly && !event.published) {
      continue;
    }

    summaries.push({
      id: event.id,
      title: event.title,
      city: event.city,
      venue: event.venue,
      date: event.date,
      published: event.published,
      tiers: Array.from(event.tiers.values(), (tier) => ({
        id: tier.id,
        name: tier.name,
        priceCents: tier.priceCents,
        capacity: tier.capacity,
        sold: tier.sold,
        available: tier.available
      }))
    });
  }
  return summaries;
}
