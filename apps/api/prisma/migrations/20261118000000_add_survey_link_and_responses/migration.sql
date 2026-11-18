ALTER TABLE "campaigns" ADD COLUMN "surveyId" TEXT;

CREATE TABLE "builder_survey_responses" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "questionsSnapshot" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "builder_survey_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "builder_survey_responses_applicationId_key" ON "builder_survey_responses"("applicationId");
CREATE INDEX "builder_survey_responses_surveyId_idx" ON "builder_survey_responses"("surveyId");
