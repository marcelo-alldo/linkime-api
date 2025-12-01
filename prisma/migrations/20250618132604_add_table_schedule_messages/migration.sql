-- CreateTable
CREATE TABLE `scheduled_messages` (
    `uid` VARCHAR(191) NOT NULL,
    `user_uid` VARCHAR(255) NOT NULL,
    `instance` VARCHAR(255) NOT NULL,
    `message` TEXT NULL,
    `delivery_at` DATETIME(3) NOT NULL,
    `status` ENUM('SENT', 'DELIVERED', 'READ', 'FAILED', 'PENDING') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scheduled_message_recipients` (
    `uid` VARCHAR(191) NOT NULL,
    `scheduled_message_uid` VARCHAR(255) NOT NULL,
    `remote_jid` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NULL,
    `lead_uid` VARCHAR(255) NULL,
    `client_uid` VARCHAR(255) NULL,
    `whatsapp_id` VARCHAR(255) NULL,
    `status` ENUM('SENT', 'DELIVERED', 'READ', 'FAILED', 'PENDING') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `scheduled_messages` ADD CONSTRAINT `scheduled_messages_user_uid_fkey` FOREIGN KEY (`user_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduled_message_recipients` ADD CONSTRAINT `scheduled_message_recipients_scheduled_message_uid_fkey` FOREIGN KEY (`scheduled_message_uid`) REFERENCES `scheduled_messages`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduled_message_recipients` ADD CONSTRAINT `scheduled_message_recipients_lead_uid_fkey` FOREIGN KEY (`lead_uid`) REFERENCES `leads`(`uid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduled_message_recipients` ADD CONSTRAINT `scheduled_message_recipients_client_uid_fkey` FOREIGN KEY (`client_uid`) REFERENCES `clients`(`uid`) ON DELETE SET NULL ON UPDATE CASCADE;
