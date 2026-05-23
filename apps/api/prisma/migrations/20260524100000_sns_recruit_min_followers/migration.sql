-- Add new numeric minFollowers column
ALTER TABLE "campaign_sns_recruits"
  ADD COLUMN "minFollowers" INTEGER NOT NULL DEFAULT 0;

-- Best-effort backfill: pull leading digits out of the old free-text condition.
UPDATE "campaign_sns_recruits"
   SET "minFollowers" = COALESCE(
       NULLIF(regexp_replace("condition", '[^0-9]', '', 'g'), '')::INTEGER,
       0
     );

-- Drop the old free-text column
ALTER TABLE "campaign_sns_recruits" DROP COLUMN "condition";
