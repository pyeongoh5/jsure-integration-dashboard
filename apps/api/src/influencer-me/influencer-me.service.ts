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
      data: {
        postalCode: input.postalCode,
        prefecture: input.prefecture,
        city: input.city,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 ?? "",
      },
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
    await this.prisma.influencerBankAccount.upsert({
      where: { influencerId },
      create: {
        influencerId,
        bankCode: input.bankCode,
        bankName: input.bankName,
        branchName: input.branchName,
        branchCode: input.branchCode,
        accountNumber: input.accountNumber,
        accountHolderKana: input.accountHolderKana,
        invoiceRegistrationNumber: input.invoiceRegistrationNumber ?? null,
      },
      update: {
        bankCode: input.bankCode,
        bankName: input.bankName,
        branchName: input.branchName,
        branchCode: input.branchCode,
        accountNumber: input.accountNumber,
        accountHolderKana: input.accountHolderKana,
        invoiceRegistrationNumber: input.invoiceRegistrationNumber ?? null,
      },
    });
  }
}
