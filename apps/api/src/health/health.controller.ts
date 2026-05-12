import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@jsure/shared";

@Controller("health")
export class HealthController {
  private readonly startedAt = Date.now();

  @Get()
  check(): HealthResponse {
    return {
      status: "ok",
      uptime: (Date.now() - this.startedAt) / 1000,
      timestamp: new Date().toISOString(),
    };
  }
}
