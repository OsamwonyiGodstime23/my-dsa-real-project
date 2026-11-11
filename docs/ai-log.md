# AI log

Every time you give an AI tool a significant prompt, add an entry. Three lines each.
"Nothing was wrong" is allowed, but it is rarely true. Your instructor will read this.

## Build 1

### Prompt 1: Build 1 domain core (docs/build-1.md)
- **What I asked:** Implement the in-memory ticket booking domain, readable IDs, linked FIFO waitlist, demo, and lookup benchmark.
- **What came back:** The initial implementation had the main domain flows, but exported `referenceCode` rather than `newReference`, omitted validation for several fields, and used `Math.random` for benchmark targets.
- **What was wrong (or "nothing"):** I added the requested `newReference` API, strengthened input and safe-integer validation, made booking failures leave inventory unchanged, and switched benchmark selection to `node:crypto`. I was unsure whether an attendee waiting for a partial number of available seats should be admitted to the queue; the current rule queues only if that attendee's full requested quantity is unavailable.

## Build 2

### Prompt 1: Build 2 prompt (docs/build-2.md)
- **What I asked:** Add stable merge sort, event publishing and summaries, pure event search/filter/sort functions, Build 2 acceptance tests, and an `npm test` command.
- **What came back:** Added the requested domain behavior and 25 built-in tests; the existing demo now creates and publishes a complete event before booking.
- **What was wrong (or "nothing"):** The Build 2 document's S04 section had no class-written criteria, so tests cover publishing a tiered event, rejecting tierless publication, and hiding an unpublished event. Date-only range bounds use the ISO date portion so the entire written calendar day is included.

### Prompt 2:
- **What I asked:**
- **What came back:**
- **What was wrong (or "nothing"):**
