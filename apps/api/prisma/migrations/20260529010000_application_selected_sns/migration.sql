-- Add selectedSnsTypes to campaign_applications (influencer's chosen SNS at application time)
ALTER TABLE "campaign_applications"
ADD COLUMN "selectedSnsTypes" "SnsType"[] NOT NULL DEFAULT ARRAY[]::"SnsType"[];
