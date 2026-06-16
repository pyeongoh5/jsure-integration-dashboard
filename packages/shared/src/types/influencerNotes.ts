import { z } from "zod";

export const InfluencerMemoEntrySchema = z.object({
  id: z.string(),
  comment: z.string(),
  createdAt: z.string().datetime(),
  createdBy: z
    .object({ id: z.string(), name: z.string().nullable() })
    .nullable(),
});
export type InfluencerMemoEntry = z.infer<typeof InfluencerMemoEntrySchema>;

export const InfluencerApplicationRejectionEntrySchema = z.object({
  applicationId: z.string(),
  comment: z.string(),
  rejectedAt: z.string().datetime().nullable(),
  campaignTitle: z.string(),
});
export type InfluencerApplicationRejectionEntry = z.infer<
  typeof InfluencerApplicationRejectionEntrySchema
>;

export const InfluencerPostRejectionEntrySchema = z.object({
  id: z.string(),
  postId: z.string(),
  comment: z.string(),
  rejectedAt: z.string().datetime(),
  campaignTitle: z.string(),
});
export type InfluencerPostRejectionEntry = z.infer<
  typeof InfluencerPostRejectionEntrySchema
>;

export const InfluencerNotesResponseSchema = z.object({
  memos: z.array(InfluencerMemoEntrySchema),
  applicationRejections: z.array(InfluencerApplicationRejectionEntrySchema),
  postRejections: z.array(InfluencerPostRejectionEntrySchema),
  flaggedAt: z.string().datetime().nullable(),
});
export type InfluencerNotesResponse = z.infer<
  typeof InfluencerNotesResponseSchema
>;

export const CreateInfluencerMemoRequestSchema = z.object({
  comment: z.string().min(1, "메모를 입력하세요").max(2000),
});
export type CreateInfluencerMemoRequest = z.infer<
  typeof CreateInfluencerMemoRequestSchema
>;
