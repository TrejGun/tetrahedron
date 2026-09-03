import { describe, expect, it } from "@jest/globals";
import { BadGatewayException } from "@nestjs/common";
import axios, { AxiosError } from "axios";

import { IsInt } from "class-validator";

import { axiosRequestKey, canRetry, isRetryableAxiosError, isUncertainWrite, parseUpstream } from "./helpers";

class SampleDto {
  @IsInt()
  id: number;
}

const getConfig = { method: "get" as const, headers: {} };

describe("axiosRequestKey", () => {
  const instance = axios.create({ baseURL: "http://127.0.0.1:4040" });

  it("keys by method and resolved URI, including query params", () => {
    expect(axiosRequestKey(instance, { method: "get", url: "/1" })).toBe("get http://127.0.0.1:4040/1");
    expect(axiosRequestKey(instance, { method: "GET", url: "/", params: { resourceId: 1 } })).toBe(
      "get http://127.0.0.1:4040/?resourceId=1",
    );
  });
});

describe("canRetry", () => {
  const base = {
    retryable: true,
    attemptsUsed: 1,
    maxAttempts: 3,
    delayMs: 0,
    deadlineAt: 1_000,
    circuitOpen: false,
    now: 0,
  };

  it("allows another attempt inside the deadline", () => {
    expect(canRetry(base)).toBe(true);
  });

  it("stops when the delay would miss the deadline", () => {
    expect(canRetry({ ...base, delayMs: 100, deadlineAt: 50 })).toBe(false);
  });

  it("stops when the attempt budget is spent", () => {
    expect(canRetry({ ...base, attemptsUsed: 3 })).toBe(false);
  });

  it("does not retry deterministic or non-retryable failures", () => {
    expect(canRetry({ ...base, retryable: false })).toBe(false);
  });

  it("does not retry when the sliding window is open", () => {
    expect(canRetry({ ...base, circuitOpen: true })).toBe(false);
  });
});

describe("isRetryableAxiosError", () => {
  it("retries idempotent 5xx", () => {
    expect(
      isRetryableAxiosError(
        new AxiosError("fail", "ERR_BAD_RESPONSE", getConfig, undefined, {
          status: 500,
          statusText: "Internal Server Error",
          headers: {},
          config: getConfig,
          data: {},
        }),
      ),
    ).toBe(true);
  });

  it("does not retry 4xx", () => {
    expect(
      isRetryableAxiosError(
        new AxiosError("missing", "ERR_BAD_REQUEST", getConfig, undefined, {
          status: 404,
          statusText: "Not Found",
          headers: {},
          config: getConfig,
          data: {},
        }),
      ),
    ).toBe(false);
  });

  it("does not retry a 200 with a truncated body", () => {
    expect(
      isRetryableAxiosError(
        new AxiosError("parse", "ERR_BAD_RESPONSE", getConfig, undefined, {
          status: 200,
          statusText: "OK",
          headers: {},
          config: getConfig,
          data: '{"id":8,"name":',
        }),
      ),
    ).toBe(false);
  });

  it("does not retry a parse failure without a status", () => {
    expect(isRetryableAxiosError(new AxiosError("parse", "ERR_BAD_RESPONSE", getConfig))).toBe(false);
  });

  it("does not retry POST even on 5xx", () => {
    expect(
      isRetryableAxiosError(
        new AxiosError("fail", "ERR_BAD_RESPONSE", { method: "post", headers: {} }, undefined, {
          status: 500,
          statusText: "Internal Server Error",
          headers: {},
          config: { headers: {} },
          data: {},
        }),
      ),
    ).toBe(false);
  });

  it("retries network and timeout failures", () => {
    expect(isRetryableAxiosError(new AxiosError("reset", "ECONNRESET", getConfig))).toBe(true);
    expect(isRetryableAxiosError(new AxiosError("timeout", "ECONNABORTED", getConfig))).toBe(true);
  });
});

describe("isUncertainWrite", () => {
  it("treats timeouts, 5xx and malformed success bodies as uncertain", () => {
    expect(isUncertainWrite(new AxiosError("timeout", "ECONNABORTED"))).toBe(true);
    expect(
      isUncertainWrite(
        new AxiosError("fail", "ERR_BAD_RESPONSE", undefined, undefined, {
          status: 500,
          statusText: "Internal Server Error",
          headers: {},
          config: { headers: {} },
          data: {},
        }),
      ),
    ).toBe(true);
    expect(isUncertainWrite(new BadGatewayException("Malformed upstream payload"))).toBe(true);
  });

  it("treats 4xx as a certain failure", () => {
    expect(
      isUncertainWrite(
        new AxiosError("missing", "ERR_BAD_REQUEST", undefined, undefined, {
          status: 400,
          statusText: "Bad Request",
          headers: {},
          config: { headers: {} },
          data: {},
        }),
      ),
    ).toBe(false);
  });
});

describe("parseUpstream", () => {
  it("accepts a valid reservation payload", async () => {
    await expect(parseUpstream(SampleDto, { id: 1 })).resolves.toMatchObject({ id: 1 });
  });

  it("maps a validation failure to 502, not the inbound 400 tree", async () => {
    await expect(parseUpstream(SampleDto, { id: "x" })).rejects.toBeInstanceOf(BadGatewayException);
    await expect(parseUpstream(SampleDto, { id: "x" })).rejects.toMatchObject({
      message: "Malformed upstream payload",
    });
  });
});
