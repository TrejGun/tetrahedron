import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";

import { parseUpstream } from "../common/http/helpers";
import { pruneExpired } from "../common/prune-expired";
import { CatalogResourceDto } from "./dto/index";
import type { ICatalogResource } from "./interfaces/index";

@Injectable()
export class CatalogService {
  private readonly cache = new Map<number, { value: ICatalogResource; expiresAt: number }>();
  private readonly ttlMs: number;

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService,
  ) {
    this.ttlMs = ~~configService.get<string>("CATALOG_CACHE_TTL_MS", "60000");
  }

  async getById(id: number): Promise<ICatalogResource> {
    if (this.ttlMs > 0) {
      const now = Date.now();
      pruneExpired(this.cache, now);
      const hit = this.cache.get(id);
      if (hit) {
        return hit.value;
      }
    }

    const response = await firstValueFrom(this.httpService.request<unknown>({ method: "GET", url: `/${id}` }));
    const value = await parseUpstream(CatalogResourceDto, response.data);

    if (this.ttlMs > 0) {
      const now = Date.now();
      pruneExpired(this.cache, now);
      this.cache.set(id, { value, expiresAt: now + this.ttlMs });
    }

    return value;
  }
}
