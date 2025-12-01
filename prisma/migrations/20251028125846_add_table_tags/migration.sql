-- CreateTable
CREATE TABLE `tags` (
    `uid` VARCHAR(191) NOT NULL,
    `user_uid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `color` VARCHAR(7) NOT NULL,
    `enable` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tags_user_uid_name_key`(`user_uid`, `name`),
    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_tags` (
    `uid` VARCHAR(191) NOT NULL,
    `lead_uid` VARCHAR(191) NOT NULL,
    `tag_uid` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lead_tags_lead_uid_tag_uid_key`(`lead_uid`, `tag_uid`),
    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_tags` (
    `uid` VARCHAR(191) NOT NULL,
    `client_uid` VARCHAR(191) NOT NULL,
    `tag_uid` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `client_tags_client_uid_tag_uid_key`(`client_uid`, `tag_uid`),
    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tags` ADD CONSTRAINT `tags_user_uid_fkey` FOREIGN KEY (`user_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_tags` ADD CONSTRAINT `lead_tags_lead_uid_fkey` FOREIGN KEY (`lead_uid`) REFERENCES `leads`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_tags` ADD CONSTRAINT `lead_tags_tag_uid_fkey` FOREIGN KEY (`tag_uid`) REFERENCES `tags`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_tags` ADD CONSTRAINT `client_tags_client_uid_fkey` FOREIGN KEY (`client_uid`) REFERENCES `clients`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_tags` ADD CONSTRAINT `client_tags_tag_uid_fkey` FOREIGN KEY (`tag_uid`) REFERENCES `tags`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;
