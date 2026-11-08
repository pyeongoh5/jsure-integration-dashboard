import {
  InfluencerWithdrawalSchema,
  WithdrawalEligibilityResponseSchema,
} from "@jsure/shared";
import type {
  CreateWithdrawalRequest,
  InfluencerBankAccount,
  InfluencerSnsAccountInput,
  InfluencerWithdrawal,
  SnsAccountSubType,
  UpdateInfluencerAddressRequest,
  UpdateInfluencerProfileRequest,
  WithdrawalEligibilityResponse,
} from "@jsure/shared";
import { api } from "@/lib/api";

export async function updateProfile(
  input: UpdateInfluencerProfileRequest,
): Promise<void> {
  await api.patch("/influencer-me/profile", input);
}

export async function updateAddress(
  input: UpdateInfluencerAddressRequest,
): Promise<void> {
  await api.patch("/influencer-me/address", input);
}

export async function upsertSnsAccount(
  input: InfluencerSnsAccountInput,
): Promise<void> {
  await api.put("/influencer-me/sns", input);
}

export async function deleteSnsAccount(snsType: SnsAccountSubType): Promise<void> {
  await api.delete(`/influencer-me/sns/${snsType}`);
}

export async function upsertBankAccount(
  input: InfluencerBankAccount,
): Promise<void> {
  await api.put("/influencer-me/bank", input);
}

export async function fetchWithdrawalEligibility(): Promise<WithdrawalEligibilityResponse> {
  const res = await api.get("/influencer-me/withdrawal");
  return WithdrawalEligibilityResponseSchema.parse(res.data);
}

export async function requestWithdrawal(
  input: CreateWithdrawalRequest,
): Promise<InfluencerWithdrawal> {
  const res = await api.post("/influencer-me/withdrawal", input);
  return InfluencerWithdrawalSchema.parse(res.data);
}
