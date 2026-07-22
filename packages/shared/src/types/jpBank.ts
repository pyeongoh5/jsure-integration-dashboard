export type JpBankCategory =
  | "MEGA"
  | "TRUST"
  | "PUBLIC"
  | "FOREIGN"
  | "REGIONAL"
  | "REGIONAL2"
  | "SHINKIN"
  | "SHINKUMI"
  | "ROKIN"
  | "JA"
  | "SHINREN"
  | "JF"
  | "GYOREN"
  | "OTHER"
  | "SPECIAL";

export interface JpBank {
  code: string;
  nameJa: string;
  nameKo: string;
  category: JpBankCategory;
}
