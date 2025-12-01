/*
  Warnings:

  - You are about to drop the column `timestap` on the `attendant_histories` table. All the data in the column will be lost.
  - Added the required column `timestamp` to the `attendant_histories` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `attendant_histories` DROP COLUMN `timestap`,
    ADD COLUMN `timestamp` INTEGER NOT NULL;
