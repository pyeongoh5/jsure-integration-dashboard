import { z } from "zod";

export const UserRoleSchema = z.enum(["GUEST", "ADMIN", "OWNER"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStatusSchema = z.enum(["PENDING", "ACTIVE", "SUSPENDED"]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const PublicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: UserRoleSchema,
  status: UserStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastSeenAt: z.string().datetime().nullable(),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RegisterRequestSchema = LoginRequestSchema.extend({
  name: z.string().min(1).max(100).optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: PublicUserSchema,
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

export const ListUsersResponseSchema = z.object({
  users: z.array(PublicUserSchema),
});
export type ListUsersResponse = z.infer<typeof ListUsersResponseSchema>;

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
