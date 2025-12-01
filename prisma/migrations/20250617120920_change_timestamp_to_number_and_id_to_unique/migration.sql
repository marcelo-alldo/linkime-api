/*
  Warnings:

  - A unique constraint covering the columns `[id]` on the table `temp_messages` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `timestamp` on the `temp_messages` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE `temp_messages` DROP COLUMN `timestamp`,
    ADD COLUMN `timestamp` INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `temp_messages_id_key` ON `temp_messages`(`id`);
