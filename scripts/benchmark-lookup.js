const BOOKINGS = 100_000;
const LOOKUPS = 500;
const bookings = Array.from({ length: BOOKINGS }, (_, index) => ({
  reference: `REF${index}`,
  attendeeName: `Attendee ${index}`
}));
const bookingsByReference = new Map(
  bookings.map((booking) => [booking.reference, booking])
);
const targetReferences = Array.from(
  { length: LOOKUPS },
  (_, index) => `REF${(index * 197) % BOOKINGS}`
);

function timeLookups(lookup) {
  const start = process.hrtime.bigint();
  for (const reference of targetReferences) {
    if (!lookup(reference)) {
      throw new Error(`Missing benchmark booking ${reference}`);
    }
  }
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

const arrayFindMs = timeLookups((reference) =>
  bookings.find((booking) => booking.reference === reference)
);
const mapGetMs = timeLookups((reference) => bookingsByReference.get(reference));

console.log(`Bookings: ${BOOKINGS.toLocaleString()} | Lookups: ${LOOKUPS}`);
console.log(`Array.find: ${arrayFindMs.toFixed(3)} ms`);
console.log(`Map.get:    ${mapGetMs.toFixed(3)} ms`);
