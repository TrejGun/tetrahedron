import { Module } from "@nestjs/common";

import { UpstreamHttpModule } from "../common/http/upstream-http.module";
import { CatalogService } from "./catalog.service";

@Module({
  imports: [
    UpstreamHttpModule.register({
      name: "catalog",
      baseUrlKey: "CATALOG_BASE_URL",
      defaultBaseUrl: "http://127.0.0.1:4040",
    }),
  ],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
