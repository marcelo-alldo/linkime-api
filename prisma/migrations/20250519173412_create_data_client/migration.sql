/*
  Warnings:

  - You are about to drop the column `data_profile_uid` on the `clients` table. All the data in the column will be lost.
  - You are about to drop the column `ie_rg` on the `data_profiles` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[data_client_uid]` on the table `clients` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone]` on the table `data_profiles` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `data_client_uid` to the `clients` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `clients` DROP FOREIGN KEY `clients_data_profile_uid_fkey`;

-- DropIndex
DROP INDEX `clients_data_profile_uid_key` ON `clients`;

-- DropIndex
DROP INDEX `data_profiles_ie_rg_key` ON `data_profiles`;

-- DropIndex
DROP INDEX `leads_cnpj_key` ON `leads`;

-- DropIndex
DROP INDEX `leads_cpf_key` ON `leads`;

-- DropIndex
DROP INDEX `leads_email_key` ON `leads`;

-- DropIndex
DROP INDEX `leads_ie_rg_key` ON `leads`;

-- AlterTable
ALTER TABLE `clients` DROP COLUMN `data_profile_uid`,
    ADD COLUMN `data_client_uid` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `data_profiles` DROP COLUMN `ie_rg`;

-- AlterTable
ALTER TABLE `leads` MODIFY `email` VARCHAR(100) NULL;

-- CreateTable
CREATE TABLE `data_clients` (
    `uid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NULL,
    `email` VARCHAR(100) NULL,
    `phone` VARCHAR(16) NULL,
    `cpf` VARCHAR(14) NULL,
    `cnpj` VARCHAR(18) NULL,
    `fantasy_name` VARCHAR(255) NULL,
    `birth_date` DATETIME(3) NULL,
    `avatar` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `clients_data_client_uid_key` ON `clients`(`data_client_uid`);

-- CreateIndex
CREATE UNIQUE INDEX `data_profiles_phone_key` ON `data_profiles`(`phone`);

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_data_client_uid_fkey` FOREIGN KEY (`data_client_uid`) REFERENCES `data_clients`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;
