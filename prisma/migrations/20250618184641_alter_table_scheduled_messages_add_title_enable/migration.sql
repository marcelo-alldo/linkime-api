/*
  Warnings:

  - You are about to drop the column `delivery_at` on the `scheduled_messages` table. All the data in the column will be lost.
  - Added the required column `send_at` to the `scheduled_messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `scheduled_messages` table without a default value. This is not possible if the table is not empty.
  - Made the column `message` on table `scheduled_messages` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `scheduled_messages` DROP COLUMN `delivery_at`,
    ADD COLUMN `enable` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `send_at` DATETIME(3) NOT NULL,
    ADD COLUMN `title` VARCHAR(255) NOT NULL,
    MODIFY `message` TEXT NOT NULL;
