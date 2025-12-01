-- AlterTable
ALTER TABLE `clients` ADD COLUMN `ia_conversation` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `leads` ADD COLUMN `ia_conversation` BOOLEAN NOT NULL DEFAULT true;
