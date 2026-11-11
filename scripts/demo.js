import {
  addTier,
  bookTickets,
  cancelBooking,
  createEvent,
  createStore,
  findBookingByReference,
  joinWaitlist,
  publishEvent
} from "../src/domain/inventory.js";

const store = createStore();
const event = createEvent(store, {
  title: "Summer Sounds",
  city: "Lagos",
  venue: "Freedom Park",
  date: "2026-12-05"
});
const tier = addTier(store, event.id, {
  name: "General admission",
  priceCents: 5000,
  capacity: 3
});
publishEvent(store, event.id);

console.log(`Event: ${event.title} — ${tier.capacity} ${tier.name} seats`);

const adaBooking = bookTickets(store, {
  eventId: event.id,
  tierId: tier.id,
  attendeeName: "Ada",
  quantity: 2
});
console.log(`Ada books 2 tickets. Reference: ${adaBooking.reference}`);

try {
  bookTickets(store, {
    eventId: event.id,
    tierId: tier.id,
    attendeeName: "Bayo",
    quantity: 2
  });
} catch (error) {
  if (error.code !== "SOLD_OUT") {
    throw error;
  }
  console.log(`Bayo is refused: ${error.code} (${error.message})`);
}

const bayoBooking = bookTickets(store, {
  eventId: event.id,
  tierId: tier.id,
  attendeeName: "Bayo",
  quantity: 1
});
console.log(`Bayo books the last ticket. Reference: ${bayoBooking.reference}`);
console.log(`Available seats: ${tier.available} — sold out.`);

const chika = joinWaitlist(store, {
  eventId: event.id,
  tierId: tier.id,
  attendeeName: "Chika"
});
const dave = joinWaitlist(store, {
  eventId: event.id,
  tierId: tier.id,
  attendeeName: "Dave"
});
console.log(`${chika.attendeeName} and ${dave.attendeeName} join the waitlist.`);
console.log(`Find Ada's booking by reference: ${findBookingByReference(store, adaBooking.reference).attendeeName}`);

cancelBooking(store, adaBooking.reference);
console.log(`Ada cancels. ${tier.available} seats are available again.`);
console.log(`Next in line: ${store.waitlists.get(`${event.id}:${tier.id}`).peek().attendeeName}`);
