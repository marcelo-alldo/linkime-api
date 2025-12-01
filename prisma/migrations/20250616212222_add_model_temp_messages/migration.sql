-- CreateTable
CREATE TABLE `temp_messages` (
    `uid` VARCHAR(191) NOT NULL,
    `remote_jid` VARCHAR(255) NOT NULL,
    `fromMe` BOOLEAN NOT NULL,
    `user_uid` VARCHAR(255) NOT NULL,
    `id` VARCHAR(255) NOT NULL,
    `body` TEXT NULL,
    `type` VARCHAR(50) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `temp_messages` ADD CONSTRAINT `temp_messages_user_uid_fkey` FOREIGN KEY (`user_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;
