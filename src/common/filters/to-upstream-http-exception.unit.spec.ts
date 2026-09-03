import { describe, expect, it } from "@jest/globals";
import { BadGatewayException, GatewayTimeoutException, NotFoundException } from "@nestjs/common";
import { AxiosError } from "axios";

import { toUpstreamHttpException } from "./to-upstream-http-exception";

describe("toUpstreamHttpException", () => {
  it("maps a 5xx AxiosError to BadGatewayException", () => {
    const error = new AxiosError("fail", "ERR_BAD_RESPONSE", undefined, undefined, {
      status: 500,
      statusText: "Internal Server Error",
      headers: {},
      config: { headers: {} },
      data: {},
    });

    const mapped = toUpstreamHttpException(error);

    expect(mapped).toBeInstanceOf(BadGatewayException);
    expect(mapped.getStatus()).toBe(502);
  });

  it("maps an upstream 404 to NotFoundException", () => {
    const error = new AxiosError("missing", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 404,
      statusText: "Not Found",
      headers: {},
      config: { headers: {} },
      data: {},
    });

    expect(toUpstreamHttpException(error)).toBeInstanceOf(NotFoundException);
  });

  it("maps a timeout to GatewayTimeoutException", () => {
    const error = new AxiosError("timeout", "ECONNABORTED");

    expect(toUpstreamHttpException(error)).toBeInstanceOf(GatewayTimeoutException);
  });
});
