-- AlterTable
ALTER TABLE `scheduled_messages` ADD COLUMN `message_template_uid` VARCHAR(255) NULL;

-- AddForeignKey
ALTER TABLE `scheduled_messages` ADD CONSTRAINT `scheduled_messages_message_template_uid_fkey` FOREIGN KEY (`message_template_uid`) REFERENCES `message_templates`(`uid`) ON DELETE SET NULL ON UPDATE CASCADE;
