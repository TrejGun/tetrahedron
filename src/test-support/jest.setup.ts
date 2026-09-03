import "reflect-metadata";
import { afterEach, jest } from "@jest/globals";
import { Logger } from "@nestjs/common";
import nock from "nock";

const noop = (): void => undefined;

jest.spyOn(Logger.prototype, "log").mockImplementation(noop);
jest.spyOn(Logger.prototype, "error").mockImplementation(noop);
jest.spyOn(Logger.prototype, "warn").mockImplementation(noop);
jest.spyOn(Logger.prototype, "debug").mockImplementation(noop);
jest.spyOn(Logger.prototype, "verbose").mockImplementation(noop);
jest.spyOn(Logger.prototype, "fatal").mockImplementation(noop);

nock.disableNetConnect();
nock.enableNetConnect(host => host.includes("127.0.0.1") || host.includes("localhost"));

afterEach(() => {
  nock.cleanAll();
});
