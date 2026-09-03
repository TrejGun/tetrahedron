import { ApiProperty } from "@nestjs/swagger";

import type { IHydratedResource } from "../interfaces/index";

export class HydratedResourceDto implements IHydratedResource {
  @ApiProperty({ example: "Conference Room A", description: "Human-readable resource name from catalog" })
  name: string;

  @ApiProperty({ example: "room", description: "Resource kind, e.g. room, gpu, vehicle" })
  kind: string;

  @ApiProperty({ example: 8, description: "How many people or units the resource can hold" })
  capacity: number;

  @ApiProperty({ example: "Europe/Lisbon", description: "IANA timezone used for local time projection" })
  timezone: string;
}
