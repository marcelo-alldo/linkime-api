-- AlterTable
ALTER TABLE `clients` ADD COLUMN `archived` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `leads` ADD COLUMN `archived` BOOLEAN NOT NULL DEFAULT false;
