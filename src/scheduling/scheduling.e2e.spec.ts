import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { NestExpressApplication } from "@nestjs/platform-express";
import nock from "nock";
import request from "supertest";

import { expectDtoConstraint } from "../test-support/expect-dto-constraint";
import { initApp } from "../test-support/init-app";
import { IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_KEY_MAX_LENGTH, IDEMPOTENCY_KEY_PATTERN } from "./dto/idempotency-key";

const CATALOG_BASE_URL = "http://127.0.0.1:4040";
const RESERVATIONS_BASE_URL = "http://127.0.0.1:5050";

const reservation = {
  id: 1,
  resourceId: 1,
  holder: "alice@example.com",
  startsAt: "2026-06-01T09:00:00Z",
  endsAt: "2026-06-01T10:00:00Z",
};

const resource = {
  id: 1,
  name: "Conference Room A",
  kind: "room",
  capacity: 8,
  timezone: "Europe/Lisbon",
};

const hydrated = {
  id: 1,
  resourceId: 1,
  resource: {
    name: "Conference Room A",
    kind: "room",
    capacity: 8,
    timezone: "Europe/Lisbon",
  },
  holder: "alice@example.com",
  startsAt: "2026-06-01T09:00:00Z",
  endsAt: "2026-06-01T10:00:00Z",
  localStartsAt: "2026-06-01T10:00:00+01:00",
  localEndsAt: "2026-06-01T11:00:00+01:00",
  durationMinutes: 60,
};

describe("GET /reservations/:id", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await initApp({
      config: {
        CATALOG_BASE_URL,
        RESERVATIONS_BASE_URL,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns a hydrated reservation", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").reply(200, reservation);
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);

    const response = await request(app.getHttpServer()).get("/reservations/1").expect(200);
    expect(response.body).toEqual(hydrated);
  });

  it("retries a transient reservations 5xx and then hydrates", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").reply(500);
    nock(RESERVATIONS_BASE_URL).get("/1").reply(200, reservation);
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);

    const response = await request(app.getHttpServer()).get("/reservations/1").expect(200);
    expect(response.body).toEqual(hydrated);
  });

  it("maps an upstream 404 to 404", async () => {
    nock(RESERVATIONS_BASE_URL).get("/99").reply(404);

    await request(app.getHttpServer()).get("/reservations/99").expect(404);
  });

  it("returns 502 Bad Gateway after the retry budget is exhausted", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").times(3).reply(500);

    const response = await request(app.getHttpServer()).get("/reservations/1").expect(502);
    expect(response.body).toEqual({
      statusCode: 502,
      message: "Upstream error",
      error: "Bad Gateway",
    });
  });

  it("returns 502 CATALOG_UNAVAILABLE when the reservation exists but catalog is down", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").reply(200, reservation);
    nock(CATALOG_BASE_URL).get("/1").times(3).reply(500);

    const response = await request(app.getHttpServer()).get("/reservations/1").expect(502);
    expect(response.body).toEqual({
      statusCode: 502,
      error: "Bad Gateway",
      message: "Reservation hydration failed",
      code: "CATALOG_UNAVAILABLE",
    });
  });

  it("returns 502 CATALOG_NOT_FOUND when the reservation exists but the resource does not", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").reply(200, reservation);
    nock(CATALOG_BASE_URL).get("/1").reply(404);

    const response = await request(app.getHttpServer()).get("/reservations/1").expect(502);
    expect(response.body).toEqual({
      statusCode: 502,
      error: "Bad Gateway",
      message: "Reservation hydration failed",
      code: "CATALOG_NOT_FOUND",
    });
  });

  it("returns 502 MALFORMED_PAYLOAD when catalog returns truncated JSON", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").reply(200, reservation);
    nock(CATALOG_BASE_URL).get("/1").reply(200, '{"id":1,"name":', { "Content-Type": "application/json" });

    const response = await request(app.getHttpServer()).get("/reservations/1").expect(502);
    expect(response.body).toEqual({
      statusCode: 502,
      error: "Bad Gateway",
      message: "Reservation hydration failed",
      code: "MALFORMED_PAYLOAD",
    });
  });

  it("returns 502 MALFORMED_PAYLOAD when the resource timezone is not a valid IANA zone", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").reply(200, reservation);
    nock(CATALOG_BASE_URL)
      .get("/1")
      .reply(200, { ...resource, timezone: "Not/AZone" });

    const response = await request(app.getHttpServer()).get("/reservations/1").expect(502);
    expect(response.body).toEqual({
      statusCode: 502,
      error: "Bad Gateway",
      message: "Reservation hydration failed",
      code: "MALFORMED_PAYLOAD",
    });
  });

  it("rejects a non-numeric id", async () => {
    const response = await request(app.getHttpServer()).get("/reservations/foo").expect(400);
    expectDtoConstraint(response.body, "id", "isInt", "id must be an integer number");
  });

  it("rejects a non-positive id", async () => {
    const response = await request(app.getHttpServer()).get("/reservations/0").expect(400);
    expectDtoConstraint(response.body, "id", "min", "id must not be less than 1");
  });

  it("coalesces concurrent reads of the same id into one upstream round-trip", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").delay(50).reply(200, reservation);
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);

    const [a, b] = await Promise.all([
      request(app.getHttpServer()).get("/reservations/1"),
      request(app.getHttpServer()).get("/reservations/1"),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body).toEqual(hydrated);
    expect(b.body).toEqual(hydrated);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("shares a catalog GET across concurrent reads of different reservations on the same resource", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").reply(200, reservation);
    nock(RESERVATIONS_BASE_URL)
      .get("/2")
      .reply(200, { ...reservation, id: 2 });
    nock(CATALOG_BASE_URL).get("/1").delay(50).reply(200, resource);

    const [a, b] = await Promise.all([
      request(app.getHttpServer()).get("/reservations/1"),
      request(app.getHttpServer()).get("/reservations/2"),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body).toEqual(hydrated);
    expect(b.body).toEqual({ ...hydrated, id: 2 });
    expect(nock.pendingMocks()).toEqual([]);
  });
});

const reservation2 = {
  id: 2,
  resourceId: 1,
  holder: "bob@example.com",
  startsAt: "2026-06-01T11:00:00Z",
  endsAt: "2026-06-01T12:00:00Z",
};

const reservation3 = {
  id: 3,
  resourceId: 2,
  holder: "carol@example.com",
  startsAt: "2026-06-02T14:00:00Z",
  endsAt: "2026-06-02T16:00:00Z",
};

const hydrated2 = {
  ...hydrated,
  id: 2,
  holder: "bob@example.com",
  startsAt: "2026-06-01T11:00:00Z",
  endsAt: "2026-06-01T12:00:00Z",
  localStartsAt: "2026-06-01T12:00:00+01:00",
  localEndsAt: "2026-06-01T13:00:00+01:00",
};

describe("GET /reservations", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await initApp({
      config: {
        CATALOG_BASE_URL,
        RESERVATIONS_BASE_URL,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns a hydrated page with skip/take owned by us", async () => {
    nock(RESERVATIONS_BASE_URL).get("/").reply(200, [reservation, reservation2, reservation3]);
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);

    const response = await request(app.getHttpServer()).get("/reservations").query({ skip: 1, take: 1 }).expect(200);

    expect(response.body).toEqual({ rows: [hydrated2], count: 3 });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("forwards resourceId to the upstream list", async () => {
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, [reservation, reservation2]);
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);

    const response = await request(app.getHttpServer()).get("/reservations").query({ resourceId: 1 }).expect(200);

    expect(response.body).toEqual({ rows: [hydrated, hydrated2], count: 2 });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("filters by overlap with a half-open from/to window", async () => {
    nock(RESERVATIONS_BASE_URL).get("/").reply(200, [reservation, reservation2]);
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);

    const response = await request(app.getHttpServer())
      .get("/reservations")
      .query({ from: "2026-06-01T09:00:00Z", to: "2026-06-01T10:30:00Z" })
      .expect(200);

    expect(response.body).toEqual({ rows: [hydrated], count: 1 });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("does not treat a back-to-back window as an overlap", async () => {
    nock(RESERVATIONS_BASE_URL).get("/").reply(200, [reservation, reservation2]);

    const response = await request(app.getHttpServer())
      .get("/reservations")
      .query({ from: "2026-06-01T10:00:00Z", to: "2026-06-01T11:00:00Z" })
      .expect(200);

    expect(response.body).toEqual({ rows: [], count: 0 });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 400 when from is set without to", async () => {
    const response = await request(app.getHttpServer())
      .get("/reservations")
      .query({ from: "2026-06-01T09:00:00Z" })
      .expect(400);
    expectDtoConstraint(
      response.body,
      "from",
      "completeOverlapWindow",
      "from and to must both be present as ISO-8601 instants with from < to",
    );
  });

  it("returns 502 CATALOG_UNAVAILABLE when a row on the page cannot be hydrated", async () => {
    nock(RESERVATIONS_BASE_URL).get("/").reply(200, [reservation]);
    nock(CATALOG_BASE_URL).get("/1").times(3).reply(500);

    const response = await request(app.getHttpServer()).get("/reservations").expect(502);
    expect(response.body).toEqual({
      statusCode: 502,
      error: "Bad Gateway",
      message: "Reservation hydration failed",
      code: "CATALOG_UNAVAILABLE",
    });
  });
});

const write = {
  resourceId: 1,
  holder: "alice@example.com",
  startsAt: "2026-06-01T09:00:00Z",
  endsAt: "2026-06-01T10:00:00Z",
};

describe("POST /reservations", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await initApp({
      config: {
        CATALOG_BASE_URL,
        RESERVATIONS_BASE_URL,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates a hydrated reservation with one catalog GET and one POST", async () => {
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, []);
    nock(RESERVATIONS_BASE_URL).post("/", write).reply(201, reservation);

    const response = await request(app.getHttpServer()).post("/reservations").send(write).expect(201);

    expect(response.body).toEqual(hydrated);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 201 without POSTing when the same natural key already exists", async () => {
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, [reservation]);

    const response = await request(app.getHttpServer()).post("/reservations").send(write).expect(201);

    expect(response.body).toEqual(hydrated);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 409 OVERLAP with the conflicting windows", async () => {
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, [reservation]);

    const response = await request(app.getHttpServer())
      .post("/reservations")
      .send({ ...write, holder: "bob@example.com", startsAt: "2026-06-01T09:30:00Z", endsAt: "2026-06-01T10:30:00Z" })
      .expect(409);

    expect(response.body).toEqual({
      statusCode: 409,
      error: "Conflict",
      message: "Reservation overlaps an existing reservation",
      code: "OVERLAP",
      conflicts: [{ id: 1, startsAt: reservation.startsAt, endsAt: reservation.endsAt }],
    });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("allows a back-to-back window", async () => {
    const next = {
      id: 2,
      resourceId: 1,
      holder: "bob@example.com",
      startsAt: "2026-06-01T10:00:00Z",
      endsAt: "2026-06-01T11:00:00Z",
    };
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, [reservation]);
    nock(RESERVATIONS_BASE_URL)
      .post("/", { resourceId: 1, holder: "bob@example.com", startsAt: next.startsAt, endsAt: next.endsAt })
      .reply(201, next);

    const response = await request(app.getHttpServer())
      .post("/reservations")
      .send({ resourceId: 1, holder: "bob@example.com", startsAt: next.startsAt, endsAt: next.endsAt })
      .expect(201);

    expect(response.body).toMatchObject({ id: 2, startsAt: next.startsAt, endsAt: next.endsAt });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 400 RESOURCE_NOT_FOUND when catalog does not have the resource", async () => {
    nock(CATALOG_BASE_URL).get("/1").reply(404);

    const response = await request(app.getHttpServer()).post("/reservations").send(write).expect(400);

    expect(response.body).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: "Catalog resource not found",
      code: "RESOURCE_NOT_FOUND",
    });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 502 CATALOG_UNAVAILABLE when catalog is down before the write", async () => {
    nock(CATALOG_BASE_URL).get("/1").times(3).reply(500);

    const response = await request(app.getHttpServer()).post("/reservations").send(write).expect(502);

    expect(response.body).toEqual({
      statusCode: 502,
      error: "Bad Gateway",
      message: "Catalog resource could not be loaded",
      code: "CATALOG_UNAVAILABLE",
    });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 400 when endsAt is not after startsAt", async () => {
    const response = await request(app.getHttpServer())
      .post("/reservations")
      .send({ ...write, endsAt: write.startsAt })
      .expect(400);
    expectDtoConstraint(response.body, "endsAt", "endsAfterStart", "endsAt must be after startsAt");
  });

  it("returns 400 when holder is outside the allowed charset", async () => {
    const response = await request(app.getHttpServer())
      .post("/reservations")
      .send({ ...write, holder: "alice example" })
      .expect(400);
    expectDtoConstraint(
      response.body,
      "holder",
      "matches",
      "holder must match /^[A-Za-z0-9._@+-]+$/ regular expression",
    );
  });

  it("returns 400 when holder exceeds 256 characters", async () => {
    const response = await request(app.getHttpServer())
      .post("/reservations")
      .send({ ...write, holder: "a".repeat(257) })
      .expect(400);
    expectDtoConstraint(response.body, "holder", "maxLength", "holder must be shorter than or equal to 256 characters");
  });

  it("returns 400 when Idempotency-Key is outside the allowed charset", async () => {
    const response = await request(app.getHttpServer())
      .post("/reservations")
      .set("Idempotency-Key", "create 1")
      .send(write)
      .expect(400);
    expectDtoConstraint(
      response.body,
      IDEMPOTENCY_KEY_HEADER,
      "matches",
      `${IDEMPOTENCY_KEY_HEADER} must match ${IDEMPOTENCY_KEY_PATTERN} regular expression`,
    );
  });

  it("returns 400 when Idempotency-Key exceeds 256 characters", async () => {
    const response = await request(app.getHttpServer())
      .post("/reservations")
      .set("Idempotency-Key", "a".repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1))
      .send(write)
      .expect(400);
    expectDtoConstraint(
      response.body,
      IDEMPOTENCY_KEY_HEADER,
      "maxLength",
      `${IDEMPOTENCY_KEY_HEADER} must be shorter than or equal to ${IDEMPOTENCY_KEY_MAX_LENGTH} characters`,
    );
  });

  it("replays Idempotency-Key without a second POST", async () => {
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, []);
    nock(RESERVATIONS_BASE_URL).post("/", write).reply(201, reservation);

    const first = await request(app.getHttpServer())
      .post("/reservations")
      .set("Idempotency-Key", "create-1")
      .send(write)
      .expect(201);
    const second = await request(app.getHttpServer())
      .post("/reservations")
      .set("Idempotency-Key", "create-1")
      .send(write)
      .expect(201);

    expect(first.body).toEqual(hydrated);
    expect(second.body).toEqual(hydrated);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 409 IDEMPOTENCY_KEY_REUSE when the same key is sent with a different body", async () => {
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, []);
    nock(RESERVATIONS_BASE_URL).post("/", write).reply(201, reservation);

    await request(app.getHttpServer()).post("/reservations").set("Idempotency-Key", "create-2").send(write).expect(201);

    const response = await request(app.getHttpServer())
      .post("/reservations")
      .set("Idempotency-Key", "create-2")
      .send({ ...write, holder: "bob@example.com" })
      .expect(409);

    expect(response.body).toEqual({
      statusCode: 409,
      error: "Conflict",
      message: "Idempotency-Key was reused with a different body",
      code: "IDEMPOTENCY_KEY_REUSE",
    });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 201 when POST is uncertain but a subsequent list finds the intent", async () => {
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, []);
    nock(RESERVATIONS_BASE_URL).post("/", write).reply(500);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, [reservation]);

    const response = await request(app.getHttpServer()).post("/reservations").send(write).expect(201);

    expect(response.body).toEqual(hydrated);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 504 when POST is uncertain and a subsequent list does not find the intent", async () => {
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, []);
    nock(RESERVATIONS_BASE_URL).post("/", write).replyWithError({ code: "ECONNABORTED", message: "timeout" });
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, []);

    const response = await request(app.getHttpServer()).post("/reservations").send(write).expect(504);

    expect(response.body).toEqual({
      statusCode: 504,
      message: "Reservation create did not confirm",
      error: "Gateway Timeout",
    });
    expect(nock.pendingMocks()).toEqual([]);
  });
});

describe("PUT /reservations/:id", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await initApp({
      config: {
        CATALOG_BASE_URL,
        RESERVATIONS_BASE_URL,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("replaces without a PUT when the body already matches the row", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").times(2).reply(200, reservation);
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, [reservation]);

    const response = await request(app.getHttpServer()).put("/reservations/1").send(write).expect(200);

    expect(response.body).toEqual(hydrated);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("does not skip PUT when the row changed under the lock", async () => {
    const concurrent = { ...reservation, holder: "carol@example.com" };
    nock(RESERVATIONS_BASE_URL).get("/1").reply(200, reservation);
    nock(RESERVATIONS_BASE_URL).get("/1").reply(200, concurrent);
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, [concurrent]);
    nock(RESERVATIONS_BASE_URL).put("/1", write).reply(200, reservation);

    const response = await request(app.getHttpServer()).put("/reservations/1").send(write).expect(200);

    expect(response.body).toEqual(hydrated);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("replaces a shifted window with one PUT and no second catalog GET", async () => {
    const next = { ...write, startsAt: "2026-06-01T10:00:00Z", endsAt: "2026-06-01T11:00:00Z" };
    const replaced = { ...reservation, ...next };
    nock(RESERVATIONS_BASE_URL).get("/1").times(2).reply(200, reservation);
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, [reservation]);
    nock(RESERVATIONS_BASE_URL).put("/1", next).reply(200, replaced);

    const response = await request(app.getHttpServer()).put("/reservations/1").send(next).expect(200);

    expect(response.body).toMatchObject({ startsAt: next.startsAt, endsAt: next.endsAt });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 409 OVERLAP excluding the row being replaced", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").times(2).reply(200, reservation);
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, [reservation, reservation2]);

    const response = await request(app.getHttpServer())
      .put("/reservations/1")
      .send({ ...write, startsAt: "2026-06-01T11:00:00Z", endsAt: "2026-06-01T12:00:00Z" })
      .expect(409);

    expect(response.body).toMatchObject({
      code: "OVERLAP",
      conflicts: [{ id: 2, startsAt: reservation2.startsAt, endsAt: reservation2.endsAt }],
    });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 404 when the reservation does not exist", async () => {
    nock(RESERVATIONS_BASE_URL).get("/99").reply(404);

    await request(app.getHttpServer()).put("/reservations/99").send(write).expect(404);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 400 RESOURCE_NOT_FOUND when the target catalog resource is missing", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").times(2).reply(200, reservation);
    nock(CATALOG_BASE_URL).get("/1").reply(404);

    const response = await request(app.getHttpServer()).put("/reservations/1").send(write).expect(400);
    expect(response.body).toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 200 when PUT is uncertain but a subsequent GET matches the intent", async () => {
    const next = { ...write, holder: "bob@example.com" };
    const replaced = { ...reservation, ...next };
    nock(RESERVATIONS_BASE_URL).get("/1").times(2).reply(200, reservation);
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, [reservation]);
    nock(RESERVATIONS_BASE_URL).put("/1", next).reply(500);
    nock(RESERVATIONS_BASE_URL).get("/1").reply(200, replaced);

    const response = await request(app.getHttpServer()).put("/reservations/1").send(next).expect(200);
    expect(response.body).toMatchObject({ holder: "bob@example.com" });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 504 when PUT is uncertain and GET still has the old body", async () => {
    const next = { ...write, holder: "bob@example.com" };
    nock(RESERVATIONS_BASE_URL).get("/1").times(2).reply(200, reservation);
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, [reservation]);
    nock(RESERVATIONS_BASE_URL).put("/1", next).reply(500);
    nock(RESERVATIONS_BASE_URL).get("/1").reply(200, reservation);

    const response = await request(app.getHttpServer()).put("/reservations/1").send(next).expect(504);
    expect(response.body).toEqual({
      statusCode: 504,
      message: "Reservation replace did not confirm",
      error: "Gateway Timeout",
    });
    expect(nock.pendingMocks()).toEqual([]);
  });
});

describe("PATCH /reservations/:id", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await initApp({
      config: {
        CATALOG_BASE_URL,
        RESERVATIONS_BASE_URL,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("patches the holder and hydrates from the catalog row already loaded", async () => {
    const patch = { holder: "bob@example.com" };
    const patched = { ...reservation, ...patch };
    nock(RESERVATIONS_BASE_URL).get("/1").times(2).reply(200, reservation);
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).patch("/1", patch).reply(200, patched);

    const response = await request(app.getHttpServer()).patch("/reservations/1").send(patch).expect(200);

    expect(response.body).toMatchObject({ holder: "bob@example.com", id: 1 });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("does not reject a merged window that overlaps another reservation", async () => {
    const patch = { endsAt: "2026-06-01T10:30:00Z" };
    const patched = { ...reservation, ...patch };
    nock(RESERVATIONS_BASE_URL).get("/1").times(2).reply(200, reservation);
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).patch("/1", patch).reply(200, patched);

    const response = await request(app.getHttpServer()).patch("/reservations/1").send(patch).expect(200);

    expect(response.body).toMatchObject({ endsAt: "2026-06-01T10:30:00Z" });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 400 when holder is outside the allowed charset", async () => {
    const response = await request(app.getHttpServer())
      .patch("/reservations/1")
      .send({ holder: "alice example" })
      .expect(400);
    expectDtoConstraint(
      response.body,
      "holder",
      "matches",
      "holder must match /^[A-Za-z0-9._@+-]+$/ regular expression",
    );
  });

  it("returns 400 when the merged window is invalid", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").times(2).reply(200, reservation);

    const response = await request(app.getHttpServer())
      .patch("/reservations/1")
      .send({ endsAt: reservation.startsAt })
      .expect(400);

    expectDtoConstraint(response.body, "endsAt", "endsAfterStart", "endsAt must be after startsAt");
    expect(nock.pendingMocks()).toEqual([]);
  });
});

describe("DELETE /reservations/:id", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await initApp({
      config: {
        CATALOG_BASE_URL,
        RESERVATIONS_BASE_URL,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("cancels an existing reservation", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").times(2).reply(200, reservation);
    nock(RESERVATIONS_BASE_URL).delete("/1").reply(204);

    await request(app.getHttpServer()).delete("/reservations/1").expect(204);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 204 on a second DELETE after a successful cancel", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").times(2).reply(200, reservation);
    nock(RESERVATIONS_BASE_URL).delete("/1").reply(204);
    nock(RESERVATIONS_BASE_URL).get("/1").reply(404);

    await request(app.getHttpServer()).delete("/reservations/1").expect(204);
    await request(app.getHttpServer()).delete("/reservations/1").expect(204);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 204 when the reservation disappears after the lock is taken", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").reply(200, reservation);
    nock(RESERVATIONS_BASE_URL).get("/1").reply(404);

    await request(app.getHttpServer()).delete("/reservations/1").expect(204);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 204 when the reservation does not exist", async () => {
    nock(RESERVATIONS_BASE_URL).get("/99").reply(404);

    await request(app.getHttpServer()).delete("/reservations/99").expect(204);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 204 when DELETE is uncertain and a subsequent GET is 404", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").times(2).reply(200, reservation);
    nock(RESERVATIONS_BASE_URL).delete("/1").reply(500);
    nock(RESERVATIONS_BASE_URL).get("/1").reply(404);

    await request(app.getHttpServer()).delete("/reservations/1").expect(204);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 504 when DELETE is uncertain and the row is still there", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").times(2).reply(200, reservation);
    nock(RESERVATIONS_BASE_URL).delete("/1").reply(500);
    nock(RESERVATIONS_BASE_URL).get("/1").reply(200, reservation);

    const response = await request(app.getHttpServer()).delete("/reservations/1").expect(504);
    expect(response.body).toEqual({
      statusCode: 504,
      message: "Reservation cancel did not confirm",
      error: "Gateway Timeout",
    });
    expect(nock.pendingMocks()).toEqual([]);
  });
});

describe("GET /resources/:id/utilisation", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await initApp({
      config: {
        CATALOG_BASE_URL,
        RESERVATIONS_BASE_URL,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("summarises disjoint reservations in the window", async () => {
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, [reservation, reservation2]);

    const response = await request(app.getHttpServer())
      .get("/resources/1/utilisation")
      .query({ from: "2026-06-01T09:00:00Z", to: "2026-06-01T12:00:00Z" })
      .expect(200);

    expect(response.body).toEqual({
      resourceId: 1,
      resource: {
        name: "Conference Room A",
        kind: "room",
        capacity: 8,
        timezone: "Europe/Lisbon",
      },
      from: "2026-06-01T09:00:00Z",
      to: "2026-06-01T12:00:00Z",
      windowMinutes: 180,
      bookedMinutes: 120,
      busyMinutes: 120,
      utilisation: 120 / 180,
      distinctHolders: 2,
      reservationCount: 2,
      peakConcurrency: 1,
    });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("counts overlapping journal rows as booked minutes above busy minutes", async () => {
    const first = { ...reservation, endsAt: "2026-06-01T11:00:00Z" };
    const second = { ...reservation2, id: 2, startsAt: "2026-06-01T10:00:00Z", endsAt: "2026-06-01T12:00:00Z" };
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, [first, second]);

    const response = await request(app.getHttpServer())
      .get("/resources/1/utilisation")
      .query({ from: "2026-06-01T09:00:00Z", to: "2026-06-01T12:00:00Z" })
      .expect(200);

    expect(response.body).toMatchObject({
      bookedMinutes: 240,
      busyMinutes: 180,
      utilisation: 1,
      distinctHolders: 2,
      reservationCount: 2,
      peakConcurrency: 2,
    });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns zeros when no reservation overlaps the window", async () => {
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, []);

    const response = await request(app.getHttpServer())
      .get("/resources/1/utilisation")
      .query({ from: "2026-06-01T09:00:00Z", to: "2026-06-01T12:00:00Z" })
      .expect(200);

    expect(response.body).toMatchObject({
      bookedMinutes: 0,
      busyMinutes: 0,
      utilisation: 0,
      distinctHolders: 0,
      reservationCount: 0,
      peakConcurrency: 0,
    });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 404 when the catalog resource does not exist", async () => {
    nock(CATALOG_BASE_URL).get("/99").reply(404);

    await request(app.getHttpServer())
      .get("/resources/99/utilisation")
      .query({ from: "2026-06-01T09:00:00Z", to: "2026-06-01T12:00:00Z" })
      .expect(404);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 502 CATALOG_UNAVAILABLE when catalog is down", async () => {
    nock(CATALOG_BASE_URL).get("/1").times(3).reply(500);

    const response = await request(app.getHttpServer())
      .get("/resources/1/utilisation")
      .query({ from: "2026-06-01T09:00:00Z", to: "2026-06-01T12:00:00Z" })
      .expect(502);

    expect(response.body).toEqual({
      statusCode: 502,
      error: "Bad Gateway",
      message: "Catalog resource could not be loaded",
      code: "CATALOG_UNAVAILABLE",
    });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("returns 400 when from and to are incomplete", async () => {
    const response = await request(app.getHttpServer())
      .get("/resources/1/utilisation")
      .query({ from: "2026-06-01T09:00:00Z" })
      .expect(400);
    expectDtoConstraint(
      response.body,
      "from",
      "completeOverlapWindow",
      "from and to must both be present as ISO-8601 instants with from < to",
    );
  });
});
