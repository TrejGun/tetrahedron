import { describe, expect, it } from "@jest/globals";
import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AxiosError } from "axios";

import { CodeErrorEnum } from "../common/constants/code-error.enum";
import { toHydrationFailedException, toReadResourceError, toWriteResourceError } from "./catalog.helpers";

describe("toHydrationFailedException", () => {
  it("maps a catalog 404 to CATALOG_NOT_FOUND", () => {
    const error = new AxiosError("missing", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 404,
      statusText: "Not Found",
      headers: {},
      config: { headers: {} },
      data: {},
    });

    expect(() => toHydrationFailedException(error)).toThrow(BadGatewayException);
    try {
      toHydrationFailedException(error);
    } catch (mapped) {
      expect((mapped as BadGatewayException).getResponse()).toMatchObject({ code: CodeErrorEnum.CATALOG_NOT_FOUND });
    }
  });

  it("maps truncated JSON to MALFORMED_PAYLOAD", () => {
    const error = new AxiosError("parse", "ERR_BAD_RESPONSE");

    try {
      toHydrationFailedException(error);
      throw new Error("expected throw");
    } catch (mapped) {
      expect((mapped as BadGatewayException).getResponse()).toMatchObject({ code: CodeErrorEnum.MALFORMED_PAYLOAD });
    }
  });

  it("maps a catalog 5xx to CATALOG_UNAVAILABLE", () => {
    const error = new AxiosError("fail", "ERR_BAD_RESPONSE", undefined, undefined, {
      status: 500,
      statusText: "Internal Server Error",
      headers: {},
      config: { headers: {} },
      data: {},
    });

    try {
      toHydrationFailedException(error);
      throw new Error("expected throw");
    } catch (mapped) {
      expect((mapped as BadGatewayException).getResponse()).toMatchObject({ code: CodeErrorEnum.CATALOG_UNAVAILABLE });
    }
  });

  it("maps a timeout to CATALOG_UNAVAILABLE", () => {
    try {
      toHydrationFailedException(new AxiosError("timeout", "ECONNABORTED"));
      throw new Error("expected throw");
    } catch (mapped) {
      expect((mapped as BadGatewayException).getResponse()).toMatchObject({
        code: CodeErrorEnum.CATALOG_UNAVAILABLE,
      });
    }
  });

  it("maps Nest upstream exceptions to a hydration code", () => {
    try {
      toHydrationFailedException(new NotFoundException());
    } catch (mapped) {
      expect((mapped as BadGatewayException).getResponse()).toMatchObject({ code: CodeErrorEnum.CATALOG_NOT_FOUND });
    }
    try {
      toHydrationFailedException(new ServiceUnavailableException());
    } catch (mapped) {
      expect((mapped as BadGatewayException).getResponse()).toMatchObject({
        code: CodeErrorEnum.CATALOG_UNAVAILABLE,
      });
    }
    try {
      toHydrationFailedException(new BadGatewayException("Malformed upstream payload"));
    } catch (mapped) {
      expect((mapped as BadGatewayException).getResponse()).toMatchObject({
        code: CodeErrorEnum.MALFORMED_PAYLOAD,
      });
    }
    try {
      toHydrationFailedException(new GatewayTimeoutException());
    } catch (mapped) {
      expect((mapped as BadGatewayException).getResponse()).toMatchObject({
        code: CodeErrorEnum.CATALOG_UNAVAILABLE,
      });
    }
  });

  it("rethrows an unclassified error", () => {
    expect(() => toHydrationFailedException(new TypeError("bug"))).toThrow(TypeError);
  });
});

describe("toWriteResourceError", () => {
  it("maps a catalog 404 to RESOURCE_NOT_FOUND", () => {
    const error = new AxiosError("missing", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 404,
      statusText: "Not Found",
      headers: {},
      config: { headers: {} },
      data: {},
    });

    expect(() => toWriteResourceError(error)).toThrow(BadRequestException);
    try {
      toWriteResourceError(error);
    } catch (mapped) {
      expect((mapped as BadRequestException).getResponse()).toMatchObject({
        code: CodeErrorEnum.RESOURCE_NOT_FOUND,
      });
    }
  });

  it("maps a catalog 5xx to CATALOG_UNAVAILABLE without calling it hydration", () => {
    const error = new AxiosError("fail", "ERR_BAD_RESPONSE", undefined, undefined, {
      status: 500,
      statusText: "Internal Server Error",
      headers: {},
      config: { headers: {} },
      data: {},
    });

    try {
      toWriteResourceError(error);
      throw new Error("expected throw");
    } catch (mapped) {
      expect(mapped).toBeInstanceOf(BadGatewayException);
      expect((mapped as BadGatewayException).getResponse()).toMatchObject({
        message: "Catalog resource could not be loaded",
        code: CodeErrorEnum.CATALOG_UNAVAILABLE,
      });
    }
  });
});

describe("toReadResourceError", () => {
  it("maps a catalog 404 to Not Found", () => {
    const error = new AxiosError("missing", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 404,
      statusText: "Not Found",
      headers: {},
      config: { headers: {} },
      data: {},
    });

    expect(() => toReadResourceError(error)).toThrow(NotFoundException);
  });
});
