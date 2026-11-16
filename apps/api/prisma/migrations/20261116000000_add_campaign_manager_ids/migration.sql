ALTER TABLE "campaigns" ADD COLUMN "managerIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "campaigns_managerIds_idx" ON "campaigns" USING GIN ("managerIds");
