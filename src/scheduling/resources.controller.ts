import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { IdParamDto, ResourceUtilisationDto, UtilisationQueryDto } from "./dto/index";
import type { IResourceUtilisation } from "./interfaces/index";
import { SchedulingService } from "./scheduling.service";

@ApiTags("Resources")
@Controller("/resources")
export class ResourcesController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Get("/:id/utilisation")
  @ApiOperation({ summary: "Resource utilisation summary for a caller-supplied window" })
  @ApiParam({ name: "id", type: Number })
  @ApiOkResponse({ type: ResourceUtilisationDto })
  @ApiBadRequestResponse({ description: "`from` and `to` must be ISO-8601 instants with from < to." })
  @ApiNotFoundResponse()
  @ApiBadGatewayResponse({
    description: "Catalog was unreachable or unusable (`code`: CATALOG_UNAVAILABLE | MALFORMED_PAYLOAD).",
  })
  getUtilisation(@Param() params: IdParamDto, @Query() query: UtilisationQueryDto): Promise<IResourceUtilisation> {
    return this.schedulingService.getResourceUtilisation(params.id, query);
  }
}
