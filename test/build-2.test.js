import assert from "node:assert/strict";
import test from "node:test";
import { DomainError } from "../src/domain/errors.js";
import { filterEvents, searchEvents, sortEvents } from "../src/domain/eventSearch.js";
import {
  addTier,
  bookTickets,
  createEvent,
  createStore,
  listEventSummaries,
  publishEvent,
  unpublishEvent
} from "../src/domain/inventory.js";
import { mergeSort } from "../src/domain/sorting.js";

function makeStoreEvent({
  title = "Lagos Tech Meetup",
  city = "Lagos",
  venue = "Main Hall",
  date = "2026-12-05T17:00:00Z",
  tiers = [{ name: "General", priceCents: 5000, capacity: 3 }]
} = {}) {
  const store = createStore();
  const event = createEvent(store, { title, city, venue, date });
  const ticketTiers = tiers.map((tier) => addTier(store, event.id, tier));
  return { store, event, ticketTiers };
}

function publishedSummary(options = {}) {
  const context = makeStoreEvent(options);
  publishEvent(context.store, context.event.id);
  return {
    ...context,
    summary: listEventSummaries(context.store)[0]
  };
}

function sampleSummaries() {
  return [
    {
      id: "3",
      title: "Lagos Tech Meetup",
      city: "Lagos",
      venue: "Main Hall",
      date: "2026-12-05T17:00:00Z",
      tiers: [{ priceCents: 5000, available: 2 }]
    },
    {
      id: "1",
      title: "Abuja Jazz Night",
      city: "Abuja",
      venue: "Blue Room",
      date: "2026-12-05T12:00:00Z",
      tiers: [{ priceCents: 3000, available: 4 }]
    },
    {
      id: "2",
      title: "No Tier Event",
      city: "Lagos",
      venue: "Open Air",
      date: "2026-12-06",
      tiers: []
    }
  ];
}

function assertDomainCode(callback, code) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.code, code);
    return true;
  });
}

test("S02: creates an identified draft event that is not publicly listed", () => {
  const store = createStore();
  const event = createEvent(store, {
    title: "Lagos Tech Meetup",
    city: "Lagos",
    venue: "Main Hall",
    date: "2026-12-05"
  });

  assert.ok(event.id);
  assert.equal(event.published, false);
  assert.deepEqual(listEventSummaries(store), []);
  assert.equal(listEventSummaries(store, { publishedOnly: false })[0].title, event.title);
});

test("S02: rejects a missing title, city, or invalid date without saving an event", () => {
  const store = createStore();
  for (const eventInput of [
    { city: "Lagos", venue: "Main Hall", date: "2026-12-05" },
    { title: "Show", venue: "Main Hall", date: "2026-12-05" },
    { title: "Show", city: "Lagos", venue: "Main Hall", date: "2026-02-30" }
  ]) {
    assertDomainCode(() => createEvent(store, eventInput), "VALIDATION");
  }
  assert.equal(store.events.size, 0);
});

test("S03: a new tier records zero sold and its full capacity as available", () => {
  const { ticketTiers: [tier] } = makeStoreEvent({
    tiers: [{ name: "General", priceCents: 500000, capacity: 100 }]
  });
  assert.equal(tier.sold, 0);
  assert.equal(tier.available, 100);
});

test("S03: rejects non-whole prices and capacities below one", () => {
  const store = createStore();
  const event = createEvent(store, {
    title: "Show",
    city: "Lagos",
    venue: "Main Hall",
    date: "2026-12-05"
  });

  assertDomainCode(
    () => addTier(store, event.id, { name: "Fractional", priceCents: 1.5, capacity: 1 }),
    "VALIDATION"
  );
  assertDomainCode(
    () => addTier(store, event.id, { name: "No seats", priceCents: 1, capacity: 0 }),
    "VALIDATION"
  );
});

test("S03: rejects a tier for a missing event with NOT_FOUND", () => {
  assertDomainCode(
    () => addTier(createStore(), "missing", { name: "General", priceCents: 500, capacity: 1 }),
    "NOT_FOUND"
  );
});

test("S04: publishing without ticket tiers fails with INVALID_STATE", () => {
  const { store, event } = makeStoreEvent({ tiers: [] });
  assertDomainCode(() => publishEvent(store, event.id), "INVALID_STATE");
  assert.equal(event.published, false);
});

test("S04: a tiered event appears in the public list after publishing", () => {
  const { store, event } = makeStoreEvent();
  publishEvent(store, event.id);
  assert.equal(listEventSummaries(store).length, 1);
  assert.equal(listEventSummaries(store)[0].id, event.id);
});

test("S04: unpublishing hides an event from the public list again", () => {
  const { store, event } = publishedSummary();
  unpublishEvent(store, event.id);
  assert.deepEqual(listEventSummaries(store), []);
  assert.equal(event.published, false);
});

test("S05: text search matches title or venue without case sensitivity", () => {
  const summaries = sampleSummaries();
  assert.deepEqual(filterEvents(summaries, { q: "JAZZ" }).map(({ title }) => title), [
    "Abuja Jazz Night"
  ]);
  assert.deepEqual(filterEvents(summaries, { q: "main hall" }).map(({ title }) => title), [
    "Lagos Tech Meetup"
  ]);
});

test("S05: city matching is exact and ignores capitalization", () => {
  const summaries = sampleSummaries();
  assert.deepEqual(filterEvents(summaries, { city: "lagos" }).map(({ city }) => city), [
    "Lagos",
    "Lagos"
  ]);
});

test("S05: onlyAvailable removes events whose tiers have no seats left", () => {
  const summaries = sampleSummaries();
  summaries[0].tiers[0].available = 0;
  assert.deepEqual(filterEvents(summaries, { onlyAvailable: true }).map(({ title }) => title), [
    "Abuja Jazz Night"
  ]);
});

test("S05: filters by cheapest tier price and sorts by price, leaving no-tier events out", () => {
  const summaries = sampleSummaries();
  const result = searchEvents(summaries, { maxPriceCents: 4000 }, "price");
  assert.deepEqual(result.map(({ title }) => title), ["Abuja Jazz Night"]);
});

test("S05: sorts by date and breaks same-day ties by title", () => {
  const summaries = [
    { ...sampleSummaries()[0], id: "z", title: "Zulu", date: "2026-12-05T12:00:00Z" },
    { ...sampleSummaries()[1], id: "a", title: "Alpha", date: "2026-12-05T17:00:00Z" },
    sampleSummaries()[2]
  ];
  assert.deepEqual(sortEvents(summaries, "date").map(({ title }) => title), [
    "Alpha",
    "Zulu",
    "No Tier Event"
  ]);
});

test("S05: a date-only upper bound includes events throughout that day", () => {
  const summaries = [
    { ...sampleSummaries()[0], date: "2026-12-05T23:59:00-05:00" },
    ...sampleSummaries().slice(1)
  ];
  assert.deepEqual(filterEvents(summaries, { to: "2026-12-05" }).map(({ title }) => title), [
    "Lagos Tech Meetup",
    "Abuja Jazz Night"
  ]);
});

test("S05: the date range includes its exact lower and upper timestamps", () => {
  const summaries = sampleSummaries();
  const result = filterEvents(summaries, {
    from: "2026-12-05T12:00:00Z",
    to: "2026-12-05T12:00:00Z"
  });
  assert.deepEqual(result.map(({ title }) => title), ["Abuja Jazz Night"]);
});

test("S05: rejects invalid dates, fractional prices, and unknown sort options", () => {
  const summaries = sampleSummaries();
  assertDomainCode(() => filterEvents(summaries, { from: "2026-02-30" }), "VALIDATION");
  assertDomainCode(() => filterEvents(summaries, { maxPriceCents: 12.5 }), "VALIDATION");
  assertDomainCode(() => sortEvents(summaries, "popular"), "VALIDATION");
});

test("S05: filtering and sorting leave their input list and entries unchanged", () => {
  const summaries = sampleSummaries();
  const before = structuredClone(summaries);
  const filtered = filterEvents(summaries, { city: "lagos" });
  const sorted = sortEvents(summaries, "price");

  assert.deepEqual(summaries, before);
  assert.notEqual(filtered, summaries);
  assert.notEqual(sorted, summaries);
});

test("S05: availability sorting puts most seats first and title/id break ties", () => {
  const summaries = [
    { ...sampleSummaries()[0], id: "b", title: "Beta", tiers: [{ priceCents: 1, available: 2 }] },
    { ...sampleSummaries()[0], id: "z", title: "Alpha", tiers: [{ priceCents: 1, available: 2 }] },
    { ...sampleSummaries()[0], id: "a", title: "Alpha", tiers: [{ priceCents: 1, available: 1 }] }
  ];
  assert.deepEqual(sortEvents(summaries, "availability").map(({ id }) => id), ["z", "b", "a"]);
});

test("S05: empty event lists filter, sort, and search to a new empty list", () => {
  const empty = [];
  assert.deepEqual(filterEvents(empty, {}), []);
  assert.deepEqual(sortEvents(empty, "date"), []);
  assert.deepEqual(searchEvents(empty, {}, "price"), []);
  assert.notEqual(sortEvents(empty, "date"), empty);
});

test("mergeSort returns a stable, sorted copy without mutating its input", () => {
  const items = [
    { key: 2, order: "first" },
    { key: 1, order: "middle" },
    { key: 2, order: "second" }
  ];
  const sorted = mergeSort(items, (left, right) => left.key - right.key);

  assert.deepEqual(sorted.map(({ order }) => order), ["middle", "first", "second"]);
  assert.deepEqual(items.map(({ order }) => order), ["first", "middle", "second"]);
  assert.notEqual(sorted, items);
});

test("mergeSort rejects invalid input with VALIDATION", () => {
  assertDomainCode(() => mergeSort(null, () => 0), "VALIDATION");
  assertDomainCode(() => mergeSort([], null), "VALIDATION");
});

test("S06: booking a published event creates a pending booking in whole cents", () => {
  const { store, event, ticketTiers: [tier] } = publishedSummary({
    tiers: [{ name: "General", priceCents: 1250, capacity: 3 }]
  });
  const booking = bookTickets(store, {
    eventId: event.id,
    tierId: tier.id,
    attendeeName: "Attendee",
    quantity: 2
  });

  assert.equal(booking.status, "pending");
  assert.equal(booking.totalCents, 2500);
  assert.equal(tier.sold, 2);
  assert.equal(tier.available, 1);
});

test("S06: sold-out booking fails without changing inventory or stored bookings", () => {
  const { store, event, ticketTiers: [tier] } = publishedSummary({
    tiers: [{ name: "General", priceCents: 500, capacity: 1 }]
  });
  const originalBookingCount = store.bookings.length;
  assertDomainCode(
    () => bookTickets(store, {
      eventId: event.id,
      tierId: tier.id,
      attendeeName: "Attendee",
      quantity: 2
    }),
    "SOLD_OUT"
  );
  assert.equal(tier.available, 1);
  assert.equal(tier.sold, 0);
  assert.equal(store.bookings.length, originalBookingCount);
});

test("S06: rejects zero, negative, fractional, and over-limit ticket quantities", () => {
  const { store, event, ticketTiers: [tier] } = publishedSummary();
  for (const quantity of [0, -1, 1.5, 11]) {
    assertDomainCode(
      () => bookTickets(store, {
        eventId: event.id,
        tierId: tier.id,
        attendeeName: "Attendee",
        quantity
      }),
      "VALIDATION"
    );
  }
  assert.equal(tier.available, tier.capacity);
  assert.equal(store.bookings.length, 0);
});

test("S06: a draft event cannot be booked", () => {
  const { store, event, ticketTiers: [tier] } = makeStoreEvent();
  assertDomainCode(
    () => bookTickets(store, {
      eventId: event.id,
      tierId: tier.id,
      attendeeName: "Attendee",
      quantity: 1
    }),
    "INVALID_STATE"
  );
  assert.equal(tier.available, tier.capacity);
  assert.equal(store.bookings.length, 0);
});
