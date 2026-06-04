import { z } from "zod";

const IsoDateTime = z.string().datetime({ offset: true });

export const NoticeResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  contentHtml: z.string(),
  publishedAt: IsoDateTime,
  authorName: z.string().nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type NoticeResponse = z.infer<typeof NoticeResponseSchema>;

export const AdminNoticeListResponseSchema = z.object({
  items: z.array(NoticeResponseSchema),
  total: z.number().int().nonnegative(),
});
export type AdminNoticeListResponse = z.infer<
  typeof AdminNoticeListResponseSchema
>;

export const CreateNoticeRequestSchema = z.object({
  title: z.string().min(1, "필수 입력").max(200),
  contentHtml: z.string().min(1, "필수 입력").max(50000),
  publishedAt: IsoDateTime,
});
export type CreateNoticeRequest = z.infer<typeof CreateNoticeRequestSchema>;

export const UpdateNoticeRequestSchema = CreateNoticeRequestSchema;
export type UpdateNoticeRequest = z.infer<typeof UpdateNoticeRequestSchema>;

export const InfluencerNoticeListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  publishedAt: IsoDateTime,
});
export type InfluencerNoticeListItem = z.infer<
  typeof InfluencerNoticeListItemSchema
>;

export const InfluencerNoticeListResponseSchema = z.object({
  items: z.array(InfluencerNoticeListItemSchema),
});
export type InfluencerNoticeListResponse = z.infer<
  typeof InfluencerNoticeListResponseSchema
>;

export const InfluencerNoticeDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  contentHtml: z.string(),
  publishedAt: IsoDateTime,
});
export type InfluencerNoticeDetail = z.infer<
  typeof InfluencerNoticeDetailSchema
>;
