import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { NestExpressApplication } from "@nestjs/platform-express";
import nock from "nock";

import { ReservationsService } from "./reservations.service";
import type { IReservation, IReservationWrite } from "./interfaces/index";
import { initApp } from "../test-support/init-app";

const RESERVATIONS_BASE_URL = "http://127.0.0.1:5050";

const reservation: IReservation = {
  id: 1,
  resourceId: 1,
  holder: "alice@example.com",
  startsAt: "2026-06-01T09:00:00Z",
  endsAt: "2026-06-01T10:00:00Z",
};

const write: IReservationWrite = {
  resourceId: reservation.resourceId,
  holder: reservation.holder,
  startsAt: reservation.startsAt,
  endsAt: reservation.endsAt,
};

describe("ReservationsService", () => {
  let app: NestExpressApplication;
  let service: ReservationsService;

  beforeAll(async () => {
    app = await initApp({
      config: {
        RESERVATIONS_BASE_URL,
      },
    });
    service = app.get(ReservationsService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("gets a reservation by id", async () => {
    nock(RESERVATIONS_BASE_URL).get("/1").reply(200, reservation);

    await expect(service.getById(1)).resolves.toEqual(reservation);
  });

  it("lists reservations optionally filtered by resourceId", async () => {
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, [reservation]);

    await expect(service.list(1)).resolves.toEqual([reservation]);
  });

  it("creates a reservation", async () => {
    nock(RESERVATIONS_BASE_URL).post("/", write).reply(201, reservation);

    await expect(service.create(write)).resolves.toEqual(reservation);
  });

  it("replaces a reservation", async () => {
    nock(RESERVATIONS_BASE_URL).put("/1", write).reply(200, reservation);

    await expect(service.replace(1, write)).resolves.toEqual(reservation);
  });

  it("patches a reservation", async () => {
    nock(RESERVATIONS_BASE_URL).patch("/1", { holder: "bob@example.com" }).reply(200, reservation);

    await expect(service.patch(1, { holder: "bob@example.com" })).resolves.toEqual(reservation);
  });

  it("removes a reservation", async () => {
    nock(RESERVATIONS_BASE_URL).delete("/1").reply(204);

    await expect(service.remove(1)).resolves.toBeUndefined();
  });

  it("confirms an uncertain POST by listing the natural key", async () => {
    nock(RESERVATIONS_BASE_URL).post("/", write).reply(500);
    nock(RESERVATIONS_BASE_URL).get("/").query({ resourceId: 1 }).reply(200, [reservation]);

    await expect(service.createConfirmed(write)).resolves.toEqual(reservation);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("confirms an uncertain PUT by reading the id", async () => {
    nock(RESERVATIONS_BASE_URL).put("/1", write).reply(500);
    nock(RESERVATIONS_BASE_URL).get("/1").reply(200, reservation);

    await expect(service.replaceConfirmed(1, write)).resolves.toEqual(reservation);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("treats DELETE 404 as a confirmed cancel", async () => {
    nock(RESERVATIONS_BASE_URL).delete("/1").reply(404);

    await expect(service.removeConfirmed(1)).resolves.toBeUndefined();
    expect(nock.pendingMocks()).toEqual([]);
  });
});
