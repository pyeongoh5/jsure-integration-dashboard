import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  uptime: z.number(),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
