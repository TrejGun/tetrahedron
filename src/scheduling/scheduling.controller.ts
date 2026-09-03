import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiGatewayTimeoutResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { PaginationInterceptor } from "../common/pagination/pagination.interceptor";
import { IdempotencyHeaders } from "./decorators/idempotency-headers";
import {
  CreateReservationDto,
  HydratedReservationDto,
  HydratedReservationPageDto,
  IdParamDto,
  IDEMPOTENCY_KEY_HEADER,
  IdempotencyHeadersDto,
  PatchReservationDto,
  ReservationListQueryDto,
} from "./dto/index";
import type { IHydratedReservation } from "./interfaces/index";
import { SchedulingService } from "./scheduling.service";

@ApiTags("Reservations")
@Controller("/reservations")
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Get("/")
  @UseInterceptors(PaginationInterceptor)
  @ApiOperation({ summary: "List hydrated reservations, filtered and paginated" })
  @ApiOkResponse({ type: HydratedReservationPageDto })
  @ApiBadGatewayResponse({
    description:
      "A reservation on the page exists but hydration failed. Body includes `code`: CATALOG_UNAVAILABLE | CATALOG_NOT_FOUND | MALFORMED_PAYLOAD.",
  })
  listReservations(@Query() query: ReservationListQueryDto): Promise<[IHydratedReservation[], number]> {
    return this.schedulingService.listReservations(query);
  }

  @Post("/")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a reservation after catalog and overlap checks" })
  @ApiHeader({
    name: "Idempotency-Key",
    required: false,
    description:
      "Replay the same 201 for this key and body within the process TTL. Optional; 1–256 of [A-Za-z0-9._@+-].",
  })
  @ApiCreatedResponse({ type: HydratedReservationDto })
  @ApiBadRequestResponse({
    description: "Validation failed, or the catalog resource is missing (`code`: RESOURCE_NOT_FOUND).",
  })
  @ApiConflictResponse({
    description:
      "Window overlaps an existing reservation (`code`: OVERLAP) or Idempotency-Key was reused with a different body (`code`: IDEMPOTENCY_KEY_REUSE).",
  })
  @ApiBadGatewayResponse({
    description:
      "Catalog was unreachable or unusable before the write (`code`: CATALOG_UNAVAILABLE | MALFORMED_PAYLOAD).",
  })
  @ApiGatewayTimeoutResponse({
    description: "The reservations write outcome was uncertain and a subsequent read did not confirm the intent.",
  })
  createReservation(
    @Body() body: CreateReservationDto,
    @IdempotencyHeaders() headers: IdempotencyHeadersDto,
  ): Promise<IHydratedReservation> {
    const idempotencyKey = headers[IDEMPOTENCY_KEY_HEADER];
    return this.schedulingService.createReservation(body, idempotencyKey);
  }

  @Put("/:id")
  @ApiOperation({ summary: "Replace a reservation in full after catalog and overlap checks" })
  @ApiParam({ name: "id", type: Number })
  @ApiHeader({
    name: "Idempotency-Key",
    required: false,
    description:
      "Replay the same 200 for this key and body within the process TTL. Optional; 1–256 of [A-Za-z0-9._@+-].",
  })
  @ApiOkResponse({ type: HydratedReservationDto })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({
    description: "Validation failed, or the catalog resource is missing (`code`: RESOURCE_NOT_FOUND).",
  })
  @ApiConflictResponse({
    description:
      "Window overlaps an existing reservation (`code`: OVERLAP) or Idempotency-Key was reused with a different body (`code`: IDEMPOTENCY_KEY_REUSE).",
  })
  @ApiBadGatewayResponse({
    description:
      "Catalog was unreachable or unusable before the write (`code`: CATALOG_UNAVAILABLE | MALFORMED_PAYLOAD).",
  })
  @ApiGatewayTimeoutResponse({
    description: "The reservations PUT outcome was uncertain and a subsequent GET did not confirm the intent.",
  })
  replaceReservation(
    @Param() params: IdParamDto,
    @Body() body: CreateReservationDto,
    @IdempotencyHeaders() headers: IdempotencyHeadersDto,
  ): Promise<IHydratedReservation> {
    const idempotencyKey = headers[IDEMPOTENCY_KEY_HEADER];
    return this.schedulingService.replaceReservation(params.id, body, idempotencyKey);
  }

  @Patch("/:id")
  @ApiOperation({ summary: "Apply a partial change after catalog check on the merged view" })
  @ApiParam({ name: "id", type: Number })
  @ApiHeader({
    name: "Idempotency-Key",
    required: false,
    description:
      "Replay the same 200 for this key and merged body within the process TTL. Optional; 1–256 of [A-Za-z0-9._@+-].",
  })
  @ApiOkResponse({ type: HydratedReservationDto })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({
    description:
      "Validation failed, merged window is invalid, or the catalog resource is missing (`code`: RESOURCE_NOT_FOUND).",
  })
  @ApiConflictResponse({
    description: "Idempotency-Key was reused with a different body (`code`: IDEMPOTENCY_KEY_REUSE).",
  })
  @ApiBadGatewayResponse({
    description:
      "Catalog was unreachable or unusable before the write (`code`: CATALOG_UNAVAILABLE | MALFORMED_PAYLOAD).",
  })
  @ApiGatewayTimeoutResponse({
    description: "The reservations PATCH outcome was uncertain and a subsequent GET did not confirm the intent.",
  })
  patchReservation(
    @Param() params: IdParamDto,
    @Body() body: PatchReservationDto,
    @IdempotencyHeaders() headers: IdempotencyHeadersDto,
  ): Promise<IHydratedReservation> {
    const idempotencyKey = headers[IDEMPOTENCY_KEY_HEADER];
    return this.schedulingService.patchReservation(params.id, body, idempotencyKey);
  }

  @Delete("/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Cancel a reservation" })
  @ApiParam({ name: "id", type: Number })
  @ApiNoContentResponse()
  @ApiGatewayTimeoutResponse({
    description: "The reservations DELETE outcome was uncertain and a subsequent GET still found the row.",
  })
  cancelReservation(@Param() params: IdParamDto): Promise<void> {
    return this.schedulingService.cancelReservation(params.id);
  }

  @Get("/:id")
  @ApiOperation({ summary: "Read a single reservation, hydrated with resource metadata and local timezone" })
  @ApiParam({ name: "id", type: Number })
  @ApiOkResponse({ type: HydratedReservationDto })
  @ApiNotFoundResponse()
  @ApiBadGatewayResponse({
    description:
      "Reservation exists but hydration failed. Body includes `code`: CATALOG_UNAVAILABLE | CATALOG_NOT_FOUND | MALFORMED_PAYLOAD.",
  })
  getReservation(@Param() params: IdParamDto): Promise<IHydratedReservation> {
    return this.schedulingService.getReservation(params.id);
  }
}
