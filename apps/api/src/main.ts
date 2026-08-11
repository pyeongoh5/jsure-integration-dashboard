import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Railway 프록시 뒤에 있어 X-Forwarded-For 를 신뢰해야 req.ip 가 실제 클라이언트 IP 가 된다.
  app.getHttpAdapter().getInstance().set("trust proxy", 1);

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
