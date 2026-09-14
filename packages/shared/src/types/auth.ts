import { z } from "zod";

export const AdminUserRoleSchema = z.enum(["GUEST", "ADMIN", "OWNER"]);
export type AdminUserRole = z.infer<typeof AdminUserRoleSchema>;

export const AdminUserStatusSchema = z.enum(["PENDING", "ACTIVE", "SUSPENDED"]);
export type AdminUserStatus = z.infer<typeof AdminUserStatusSchema>;

export const PublicAdminUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: AdminUserRoleSchema,
  status: AdminUserStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastSeenAt: z.string().datetime().nullable(),
});
export type PublicAdminUser = z.infer<typeof PublicAdminUserSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RegisterRequestSchema = LoginRequestSchema.extend({
  name: z.string().min(1).max(100).optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

/** 본인 비밀번호 변경 — 현재 비밀번호로 본인을 확인한다. */
export const ChangeMyPasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangeMyPasswordRequest = z.infer<typeof ChangeMyPasswordRequestSchema>;

/**
 * 로그인 화면의 "비밀번호 찾기" — 임시 비밀번호를 메일로 받는다.
 * 응답은 계정 존재 여부와 무관하게 항상 성공이다(계정 열거 방지).
 */
export const RequestPasswordResetRequestSchema = z.object({
  email: z.string().email("이메일 형식이 올바르지 않습니다"),
});
export type RequestPasswordResetRequest = z.infer<
  typeof RequestPasswordResetRequestSchema
>;

/** OWNER 가 다른 어드민의 비밀번호를 재설정 — 현재 비밀번호를 모르는 상태를 전제한다. */
export const ResetAdminUserPasswordRequestSchema = z.object({
  newPassword: z.string().min(8),
});
export type ResetAdminUserPasswordRequest = z.infer<
  typeof ResetAdminUserPasswordRequestSchema
>;

export const PasswordChangedResponseSchema = z.object({ ok: z.literal(true) });
export type PasswordChangedResponse = z.infer<typeof PasswordChangedResponseSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: PublicAdminUserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const RefreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

export const LogoutRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;

export const RegisterResponseSchema = z.object({
  status: z.literal("PENDING"),
  email: z.string().email(),
  message: z.string(),
});
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

export const ListAdminUsersResponseSchema = z.object({
  users: z.array(PublicAdminUserSchema),
});
export type ListAdminUsersResponse = z.infer<typeof ListAdminUsersResponseSchema>;

export const SessionSummarySchema = z.object({
  id: z.string(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  isCurrent: z.boolean(),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const ListSessionsResponseSchema = z.object({
  sessions: z.array(SessionSummarySchema),
});
export type ListSessionsResponse = z.infer<typeof ListSessionsResponseSchema>;
