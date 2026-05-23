-- Rename tables
ALTER TABLE "users" RENAME TO "admin_users";
ALTER TABLE "user_sessions" RENAME TO "admin_user_sessions";

-- Rename FK column on admin_user_sessions
ALTER TABLE "admin_user_sessions" RENAME COLUMN "userId" TO "adminUserId";

-- Rename enums
ALTER TYPE "Role" RENAME TO "AdminUserRole";
ALTER TYPE "UserStatus" RENAME TO "AdminUserStatus";

-- Rename primary key constraints
ALTER TABLE "admin_users" RENAME CONSTRAINT "users_pkey" TO "admin_users_pkey";
ALTER TABLE "admin_user_sessions" RENAME CONSTRAINT "user_sessions_pkey" TO "admin_user_sessions_pkey";

-- Rename unique/index constraints
ALTER INDEX "users_email_key" RENAME TO "admin_users_email_key";
ALTER INDEX "user_sessions_refreshTokenHash_key" RENAME TO "admin_user_sessions_refreshTokenHash_key";
ALTER INDEX "user_sessions_userId_idx" RENAME TO "admin_user_sessions_adminUserId_idx";

-- Rename foreign key constraint
ALTER TABLE "admin_user_sessions" RENAME CONSTRAINT "user_sessions_userId_fkey" TO "admin_user_sessions_adminUserId_fkey";
