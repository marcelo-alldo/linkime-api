/*
  Warnings:

  - A unique constraint covering the columns `[code_ibge]` on the table `cities` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code_ibge]` on the table `states` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `cities_code_ibge_key` ON `cities`(`code_ibge`);

-- CreateIndex
CREATE UNIQUE INDEX `states_code_ibge_key` ON `states`(`code_ibge`);
