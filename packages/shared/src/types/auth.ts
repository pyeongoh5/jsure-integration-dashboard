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
  user: PublicUserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

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
