import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class InfluencersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.influencer.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.influencer.findUnique({ where: { id } });
  }

  findFull(id: string) {
    return this.prisma.influencer.findUnique({
      where: { id },
      include: { snsAccounts: true, bankAccount: true },
    });
  }
}
