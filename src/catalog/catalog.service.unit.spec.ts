import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { ServiceUnavailableException } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import nock from "nock";

import { CatalogService } from "./catalog.service";
import type { ICatalogResource } from "./interfaces/index";
import { initApp } from "../test-support/init-app";

const CATALOG_BASE_URL = "http://127.0.0.1:4040";

const resource: ICatalogResource = {
  id: 1,
  name: "Conference Room A",
  kind: "room",
  capacity: 8,
  timezone: "Europe/Lisbon",
};

describe("CatalogService", () => {
  let app: NestExpressApplication;
  let service: CatalogService;

  beforeAll(async () => {
    app = await initApp({
      config: {
        CATALOG_BASE_URL,
      },
    });
    service = app.get(CatalogService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("gets a resource by id", async () => {
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);

    await expect(service.getById(1)).resolves.toEqual(resource);
  });

  it("retries idempotent GETs on 5xx inside the sliding window and then succeeds", async () => {
    nock(CATALOG_BASE_URL).get("/1").reply(500);
    nock(CATALOG_BASE_URL).get("/1").reply(500);
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);

    await expect(service.getById(1)).resolves.toEqual(resource);
  });

  it("does not retry 404", async () => {
    nock(CATALOG_BASE_URL).get("/99").reply(404);

    await expect(service.getById(99)).rejects.toMatchObject({ response: { status: 404 } });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("does not retry a truncated JSON body", async () => {
    nock(CATALOG_BASE_URL).get("/8").reply(200, '{"id":8,"name":', { "Content-Type": "application/json" });

    await expect(service.getById(8)).rejects.toBeDefined();
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("gives up after the configured attempt budget", async () => {
    nock(CATALOG_BASE_URL).get("/6").times(3).reply(500);

    await expect(service.getById(6)).rejects.toMatchObject({ response: { status: 500 } });
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("coalesces concurrent GETs of the same id into one upstream call", async () => {
    nock(CATALOG_BASE_URL).get("/1").delay(50).reply(200, resource);

    const [a, b] = await Promise.all([service.getById(1), service.getById(1)]);

    expect(a).toEqual(resource);
    expect(b).toEqual(resource);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("shares the retry chain across concurrent GETs of the same id", async () => {
    nock(CATALOG_BASE_URL).get("/1").delay(50).reply(500);
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);

    const [a, b] = await Promise.all([service.getById(1), service.getById(1)]);

    expect(a).toEqual(resource);
    expect(b).toEqual(resource);
    expect(nock.pendingMocks()).toEqual([]);
  });
});

describe("CatalogService circuit", () => {
  let app: NestExpressApplication;
  let service: CatalogService;

  beforeAll(async () => {
    app = await initApp({
      config: {
        CATALOG_BASE_URL,
        UPSTREAM_RETRY_MAX_ATTEMPTS: "1",
        UPSTREAM_RETRY_MAX_FAILURES: "1",
      },
    });
    service = app.get(CatalogService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("fails fast once the sliding window is saturated", async () => {
    nock(CATALOG_BASE_URL).get("/1").reply(500);

    await expect(service.getById(1)).rejects.toMatchObject({ response: { status: 500 } });
    await expect(service.getById(1)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(nock.pendingMocks()).toEqual([]);
  });
});

describe("CatalogService deadline", () => {
  let app: NestExpressApplication;
  let service: CatalogService;

  beforeAll(async () => {
    app = await initApp({
      config: {
        CATALOG_BASE_URL,
        UPSTREAM_RETRY_MAX_ATTEMPTS: "3",
        UPSTREAM_RETRY_DELAY_MS: "100",
        UPSTREAM_RETRY_DEADLINE_MS: "50",
      },
    });
    service = app.get(CatalogService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("does not start another attempt when the delay would miss the deadline", async () => {
    nock(CATALOG_BASE_URL).get("/1").reply(500);

    await expect(service.getById(1)).rejects.toMatchObject({ response: { status: 500 } });
    expect(nock.pendingMocks()).toEqual([]);
  });
});

describe("CatalogService cache", () => {
  let app: NestExpressApplication;
  let service: CatalogService;

  beforeAll(async () => {
    app = await initApp({
      config: {
        CATALOG_BASE_URL,
        CATALOG_CACHE_TTL_MS: "60000",
      },
    });
    service = app.get(CatalogService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("reuses a successful GET-by-id within the TTL", async () => {
    nock(CATALOG_BASE_URL).get("/1").reply(200, resource);

    await expect(service.getById(1)).resolves.toEqual(resource);
    await expect(service.getById(1)).resolves.toEqual(resource);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("does not cache a 404", async () => {
    nock(CATALOG_BASE_URL).get("/99").reply(404);
    nock(CATALOG_BASE_URL).get("/99").reply(404);

    await expect(service.getById(99)).rejects.toMatchObject({ response: { status: 404 } });
    await expect(service.getById(99)).rejects.toMatchObject({ response: { status: 404 } });
    expect(nock.pendingMocks()).toEqual([]);
  });
});

describe("CatalogService concurrency", () => {
  let app: NestExpressApplication;
  let service: CatalogService;

  beforeAll(async () => {
    app = await initApp({
      config: {
        CATALOG_BASE_URL,
        UPSTREAM_MAX_CONCURRENT: "4",
      },
    });
    service = app.get(CatalogService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("keeps at most 4 HTTP calls in flight to catalog", async () => {
    for (let id = 1; id <= 5; id += 1) {
      nock(CATALOG_BASE_URL)
        .get(`/${id}`)
        .delay(150)
        .reply(200, { ...resource, id });
    }

    const pending = Promise.all([1, 2, 3, 4, 5].map(id => service.getById(id)));
    await new Promise(resolve => {
      setTimeout(resolve, 40);
    });
    expect(nock.pendingMocks()).toHaveLength(1);

    await pending;
    expect(nock.pendingMocks()).toEqual([]);
  });
});
