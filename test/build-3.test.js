import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../src/http/app.js";
import { createRouter } from "../src/http/router.js";
import { DomainError } from "../src/domain/errors.js";
import {
  assertTransition,
  BOOKING_STATES,
  BOOKING_TRANSITIONS,
  canTransition
} from "../src/domain/bookingStateMachine.js";
import { loadConfig } from "../src/config.js";

test("booking state machine accepts every specified transition", () => {
  for (const [from, destinations] of Object.entries(BOOKING_TRANSITIONS)) {
    for (const to of destinations) {
      assert.equal(canTransition(from, to), true);
      assert.doesNotThrow(() => assertTransition(from, to));
    }
  }
});

test("booking state machine rejects every other state pair with INVALID_TRANSITION", () => {
  for (const from of BOOKING_STATES) {
    for (const to of BOOKING_STATES) {
      if (canTransition(from, to)) {
        continue;
      }
      assert.equal(canTransition(from, to), false);
      assert.throws(() => assertTransition(from, to), (error) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "INVALID_TRANSITION");
        return true;
      });
    }
  }

  assert.equal(canTransition("unknown", "pending"), false);
  assert.equal(canTransition("toString", "pending"), false);
  assert.equal(canTransition("__proto__", "pending"), false);
  assert.throws(() => assertTransition("unknown", "pending"), {
    code: "INVALID_TRANSITION"
  });
});

test("router matches method and path parameters", () => {
  const router = createRouter();
  const handler = () => "matched";
  router.get("/events/:eventId/bookings/:bookingId", handler);

  assert.deepEqual(router.match("GET", "/events/event-1/bookings/booking-2"), {
    handler,
    params: { eventId: "event-1", bookingId: "booking-2" }
  });
  assert.equal(router.match("POST", "/events/event-1/bookings/booking-2"), null);
  assert.equal(router.match("GET", "/events/event-1"), null);
});

test("config uses the default port and validates PORT", () => {
  assert.deepEqual(loadConfig({}), { port: 3000 });
  assert.deepEqual(loadConfig({ PORT: "4321" }), { port: 4321 });
  assert.throws(() => loadConfig({ PORT: "invalid" }), /PORT must be a whole number/);
});

async function withServer(server, callback) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("GET /health responds over HTTP with JSON status ok", async () => {
  const server = createApp();
  await withServer(server, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.deepEqual(await response.json(), { status: "ok" });
  });
});

test("HTTP errors use a consistent JSON shape and invalid JSON returns 400", async () => {
  const server = createApp();
  await withServer(server, async (baseUrl) => {
    const badJson = await fetch(`${baseUrl}/api/anything`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    });
    assert.equal(badJson.status, 400);
    assert.deepEqual(await badJson.json(), {
      error: { code: "BAD_JSON", message: "Request body must contain valid JSON" }
    });

    const missingApiRoute = await fetch(`${baseUrl}/api/missing`);
    assert.equal(missingApiRoute.status, 404);
    assert.deepEqual(await missingApiRoute.json(), {
      error: { code: "NOT_FOUND", message: "Route or file not found" }
    });
  });
});

test("static files are served without allowing traversal outside public/", async () => {
  const server = createApp();
  await withServer(server, async (baseUrl) => {
    const homepage = await fetch(`${baseUrl}/`);
    assert.equal(homepage.status, 200);
    assert.match(await homepage.text(), /<title>Event Ticketing<\/title>/);

    const traversal = await fetch(`${baseUrl}/%2e%2e%2fpackage.json`);
    assert.equal(traversal.status, 404);
    assert.deepEqual(await traversal.json(), {
      error: { code: "NOT_FOUND", message: "Route or file not found" }
    });
  });
});
