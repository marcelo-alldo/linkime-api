/*
  Warnings:

  - You are about to drop the column `title` on the `addresses` table. All the data in the column will be lost.
  - You are about to drop the column `profile_uid` on the `collaborators` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[parent_uid]` on the table `collaborators` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_uid,parent_uid]` on the table `collaborators` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `parent_uid` to the `collaborators` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `collaborators` DROP FOREIGN KEY `collaborators_profile_uid_fkey`;

-- DropIndex
DROP INDEX `collaborators_profile_uid_key` ON `collaborators`;

-- AlterTable
ALTER TABLE `addresses` DROP COLUMN `title`;

-- AlterTable
ALTER TABLE `collaborators` DROP COLUMN `profile_uid`,
    ADD COLUMN `parent_uid` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `client_files` (
    `uid` VARCHAR(191) NOT NULL,
    `client_uid` VARCHAR(191) NOT NULL,
    `file_uid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `collaborators_parent_uid_key` ON `collaborators`(`parent_uid`);

-- CreateIndex
CREATE UNIQUE INDEX `collaborators_user_uid_parent_uid_key` ON `collaborators`(`user_uid`, `parent_uid`);

-- AddForeignKey
ALTER TABLE `client_files` ADD CONSTRAINT `client_files_client_uid_fkey` FOREIGN KEY (`client_uid`) REFERENCES `clients`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_files` ADD CONSTRAINT `client_files_file_uid_fkey` FOREIGN KEY (`file_uid`) REFERENCES `files`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collaborators` ADD CONSTRAINT `collaborators_parent_uid_fkey` FOREIGN KEY (`parent_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;
