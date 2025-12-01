-- CreateTable
CREATE TABLE `message_templates` (
    `uid` VARCHAR(191) NOT NULL,
    `user_uid` VARCHAR(255) NOT NULL,
    `instance` VARCHAR(255) NOT NULL,
    `name` VARCHAR(512) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `category` ENUM('AUTHENTICATION', 'MARKETING', 'UTILITY') NOT NULL DEFAULT 'UTILITY',
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `enable` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `message_templates` ADD CONSTRAINT `message_templates_user_uid_fkey` FOREIGN KEY (`user_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;
