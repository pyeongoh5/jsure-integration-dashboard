import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  InfluencerBankAccount,
  InfluencerSnsAccountInput,
  SnsAccountSubType,
  UpdateInfluencerAddressRequest,
  UpdateInfluencerProfileRequest,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { addressColumns, bankAccountColumns } from "../common/account-columns";

@Injectable()
export class InfluencerMeService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(
    influencerId: string,
    input: UpdateInfluencerProfileRequest,
  ): Promise<void> {
    await this.prisma.influencer.update({
      where: { id: influencerId },
      data: {
        name: input.name,
        nameKana: input.nameKana,
        phone: input.phone,
      },
    });
  }

  async updateAddress(
    influencerId: string,
    input: UpdateInfluencerAddressRequest,
  ): Promise<void> {
    await this.prisma.influencer.update({
      where: { id: influencerId },
      // 국가 전환 시 이전 국가의 잔여 값이 남지 않도록 전체 컬럼을 덮어쓴다.
      data: addressColumns(input),
    });
  }

  async upsertSnsAccount(
    influencerId: string,
    input: InfluencerSnsAccountInput,
  ): Promise<void> {
    await this.prisma.influencerSnsAccount.upsert({
      where: {
        influencerId_snsType: {
          influencerId,
          snsType: input.snsType,
        },
      },
      create: {
        influencerId,
        snsType: input.snsType,
        handle: input.handle,
        followerCount: input.followerCount,
      },
      update: {
        handle: input.handle,
        followerCount: input.followerCount,
      },
    });
  }

  async deleteSnsAccount(
    influencerId: string,
    snsType: SnsAccountSubType,
  ): Promise<void> {
    const count = await this.prisma.influencerSnsAccount.count({
      where: { influencerId },
    });
    if (count <= 1) {
      throw new BadRequestException({
        code: "AT_LEAST_ONE_SNS_REQUIRED",
        message: "少なくとも1つのSNSアカウントが必要です",
      });
    }
    const existing = await this.prisma.influencerSnsAccount.findUnique({
      where: { influencerId_snsType: { influencerId, snsType } },
    });
    if (!existing) {
      throw new NotFoundException("SNS account not found");
    }
    await this.prisma.influencerSnsAccount.delete({
      where: { id: existing.id },
    });
  }

  async upsertBankAccount(
    influencerId: string,
    input: InfluencerBankAccount,
  ): Promise<void> {
    // 국가 전환 시 이전 국가의 잔여 값이 남지 않도록 전체 컬럼을 덮어쓴다.
    const columns = bankAccountColumns(input);
    await this.prisma.influencerBankAccount.upsert({
      where: { influencerId },
      create: { influencerId, ...columns },
      update: columns,
    });
  }
}
