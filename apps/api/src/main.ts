import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix("api");

  app.enableCors({
    origin: config
      .get<string>("CORS_ORIGIN")
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? true,
    credentials: true,
  });

  const port = config.get<number>("PORT") ?? 3000;
  await app.listen(port, "0.0.0.0");
  Logger.log(`API ready on http://localhost:${port}/api`, "Bootstrap");
}

bootstrap();
