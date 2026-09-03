import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsString, IsTimeZone } from "class-validator";

import type { ICatalogResource } from "../interfaces/index";

export class CatalogResourceDto implements ICatalogResource {
  @ApiProperty({ example: 1, description: "Catalog resource id" })
  @IsInt()
  id: number;

  @ApiProperty({ example: "Conference Room A", description: "Human-readable resource name" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: "room", description: "Resource kind, e.g. room, gpu, vehicle" })
  @IsString()
  @IsNotEmpty()
  kind: string;

  @ApiProperty({ example: 8, description: "How many people or units the resource can hold" })
  @IsInt()
  capacity: number;

  @ApiProperty({ example: "Europe/Lisbon", description: "IANA timezone of the resource" })
  @IsTimeZone()
  timezone: string;
}
