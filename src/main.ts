import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { useContainer } from "class-validator";

import { AppModule } from "./app.module";
import { setupSwagger } from "./swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  setupSwagger(app);

  const configService = app.get(ConfigService);
  await app.listen(~~configService.get<string>("PORT", "3000"));
}

void bootstrap();
