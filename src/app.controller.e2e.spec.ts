import { afterAll, beforeAll, describe, it } from "@jest/globals";
import { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";

import { initApp } from "./test-support/init-app";

describe("AppController (e2e)", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await initApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("/ (GET)", async () => {
    await request(app.getHttpServer()).get("/").expect(301).expect("Location", "/swagger");
  });
});
