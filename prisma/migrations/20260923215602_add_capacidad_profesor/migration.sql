/*
  Warnings:

  - Added the required column `capacidad` to the `profesor` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "profesor" ADD COLUMN     "capacidad" INTEGER NOT NULL;
