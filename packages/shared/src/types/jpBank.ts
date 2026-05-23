export type JpBankCategory =
  | "MEGA"
  | "TRUST"
  | "PUBLIC"
  | "INTERNET"
  | "REGIONAL_1"
  | "REGIONAL_2";

export interface JpBank {
  code: string;
  nameJa: string;
  nameKo: string;
  category: JpBankCategory;
}
