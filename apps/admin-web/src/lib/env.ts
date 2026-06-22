import { z } from "zod";

const EnvSchema = z.object({
  VITE_SENTRY_DSN: z.string().url().optional(),
  VITE_SENTRY_ENVIRONMENT: z.string().min(1).optional(),
  VITE_SENTRY_RELEASE: z.string().min(1).optional(),
  VITE_SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
});

export const env = EnvSchema.parse(import.meta.env);
