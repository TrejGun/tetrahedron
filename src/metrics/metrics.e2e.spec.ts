import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { NestExpressApplication } from "@nestjs/platform-express";
import nock from "nock";
import request from "supertest";

import { initApp } from "../test-support/init-app";

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

describe("GET /metrics", () => {
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

  it("exposes Prometheus text with the four series names", async () => {
    const response = await request(app.getHttpServer()).get("/metrics").expect(200);

    expect(response.headers["content-type"]).toMatch(/text\/plain/);
    expect(response.text).toContain("# TYPE upstream_request_duration_seconds histogram");
    expect(response.text).toContain("# TYPE upstream_retries_total counter");
    expect(response.text).toContain("# TYPE upstream_circuit_open gauge");
    expect(response.text).toContain("# TYPE http_requests_total counter");
  });

  it("records upstream duration and inbound status after a hydrated read", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").reply(200, reservation);
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);

    await request(app.getHttpServer()).get("/reservations/1").expect(200);

    const response = await request(app.getHttpServer()).get("/metrics").expect(200);

    expect(response.text).toMatch(/upstream_request_duration_seconds_count\{[^}]*upstream="reservations"/);
    expect(response.text).toMatch(/upstream_request_duration_seconds_count\{[^}]*upstream="catalog"/);
    expect(response.text).toMatch(/http_requests_total\{method="GET",status="200"\}/);
  });
});
