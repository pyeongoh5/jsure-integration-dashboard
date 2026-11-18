import { Logger } from "@nestjs/common";
import { SurveyQuestionSchema, type SurveyQuestion } from "@jsure/shared";

const logger = new Logger("parseSurveyQuestions");

/**
 * `builder_surveys.questions` JSONB 를 읽을 때 쓰는 공용 파서.
 *
 * 느슨한 배열 스키마(SurveyQuestionsSchema 의 min(1)·id 중복 검증 없음)를 쓰는
 * 것은 의도된 선택이다 — 운영자 설정 실수로 문항이 비정상이어도 그 설문 하나
 * 때문에 무관한 기능(응모 목록 전체, 참가자 조회·엑셀 다운로드 전체)이 500 으로
 * 죽으면 안 된다. 실패하면 null 을 돌려주고 호출부가 "설문 없음"으로 넘어가되,
 * 파싱 실패 자체는 흔적 없이 사라지면 안 되므로 surveyId 를 남겨 경고 로그를 찍는다.
 */
export function parseSurveyQuestions(
  json: unknown,
  surveyId: string,
): SurveyQuestion[] | null {
  const result = SurveyQuestionSchema.array().safeParse(json);
  if (!result.success) {
    logger.warn(`설문(${surveyId}) questions 파싱 실패 — 설문 없음으로 처리합니다`);
    return null;
  }
  return result.data;
}
