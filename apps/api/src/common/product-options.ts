import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import {
  ApplicationProductOptionSchema,
  type ApplicationProductOption,
} from "@jsure/shared";

/**
 * 제품 옵션은 Json 컬럼이라 읽을 때 모양을 보장할 수 없다.
 * 깨진 행 하나가 목록 전체를 무너뜨리지 않도록 파싱 실패는 빈 배열로 떨어뜨린다.
 * 임시저장은 옵션명·옵션값이 비어 있을 수 있으므로 읽기는 느슨하게 받는다.
 */
const CampaignProductOptionsSchema = z
  .array(z.object({ name: z.string(), values: z.array(z.string()) }))
  .catch([]);

const ApplicationProductOptionsSchema = z
  .array(ApplicationProductOptionSchema)
  .catch([]);

export type StoredCampaignProductOption = z.infer<
  typeof CampaignProductOptionsSchema
>[number];

export function parseCampaignProductOptions(
  value: unknown,
): StoredCampaignProductOption[] {
  return CampaignProductOptionsSchema.parse(value ?? []);
}

export function parseApplicationProductOptions(
  value: unknown,
): ApplicationProductOption[] {
  return ApplicationProductOptionsSchema.parse(value ?? []);
}

/**
 * 응모 입력의 제품 옵션을 캠페인 설정과 대조해 저장 형태로 확정한다.
 * 캠페인이 요구하는 그룹마다 허용된 값 1개가 있어야 하고, 설정에 없는 옵션은 거부한다.
 * 반환 순서는 캠페인에 설정된 그룹 순서를 따른다.
 */
export function selectProductOptions(
  campaignProductOptions: StoredCampaignProductOption[],
  input: ApplicationProductOption[],
): ApplicationProductOption[] {
  const groups = campaignProductOptions.filter(
    (group) => group.name !== "" && group.values.length > 0,
  );
  const groupNames = new Set(groups.map((group) => group.name));
  const unexpected = input.filter((entry) => !groupNames.has(entry.name));
  if (unexpected.length > 0) {
    throw new BadRequestException({
      code: "PRODUCT_OPTION_NOT_ALLOWED",
      message: "이 캠페인에서 선택할 수 없는 옵션이 포함되어 있습니다",
    });
  }
  return groups.map((group) => {
    const selected = input.filter((entry) => entry.name === group.name);
    if (selected.length !== 1) {
      throw new BadRequestException({
        code: "PRODUCT_OPTION_REQUIRED",
        message: `옵션 "${group.name}" 을 선택해주세요`,
      });
    }
    const value = selected[0]!.value;
    if (!group.values.includes(value)) {
      throw new BadRequestException({
        code: "PRODUCT_OPTION_NOT_ALLOWED",
        message: `옵션 "${group.name}" 에서 선택할 수 없는 값입니다`,
      });
    }
    return { name: group.name, value };
  });
}
