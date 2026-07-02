-- AddForeignKey
ALTER TABLE "line_message_templates" ADD CONSTRAINT "line_message_templates_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
