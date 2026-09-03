import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { NestExpressApplication } from "@nestjs/platform-express";
import nock from "nock";
import request from "supertest";

import { initApp } from "../test-support/init-app";

const CATALOG_BASE_URL = "http://127.0.0.1:4040";
const RESERVATIONS_BASE_URL = "http://127.0.0.1:5050";

describe("Health", () => {
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

  it("GET /health/liveness", async () => {
    const response = await request(app.getHttpServer()).get("/health/liveness").expect(200);
    expect(response.body.status).toBe("ok");
  });

  it("GET /health/readiness is up when catalog and reservations respond", async () => {
    nock(CATALOG_BASE_URL).get("/").reply(400);
    nock(RESERVATIONS_BASE_URL).get("/").reply(200, []);

    const response = await request(app.getHttpServer()).get("/health/readiness").expect(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.info.catalog.status).toBe("up");
    expect(response.body.info.reservations.status).toBe("up");
  });

  it("GET /health/readiness is up when catalog has no rows (404 on GET /)", async () => {
    nock(CATALOG_BASE_URL).get("/").reply(404);
    nock(RESERVATIONS_BASE_URL).get("/").reply(200, []);

    const response = await request(app.getHttpServer()).get("/health/readiness").expect(200);
    expect(response.body.status).toBe("ok");
  });

  it("GET /health/readiness is down when catalog is unreachable", async () => {
    nock(CATALOG_BASE_URL).get("/").reply(500);
    nock(RESERVATIONS_BASE_URL).get("/").reply(200, []);

    const response = await request(app.getHttpServer()).get("/health/readiness").expect(503);
    expect(response.body.status).toBe("error");
  });
});
