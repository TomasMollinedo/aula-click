/*
  Warnings:

  - You are about to drop the column `turno_reemplazo_id` on the `turno_excepcion` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "turno_excepcion" DROP CONSTRAINT "turno_excepcion_turno_reemplazo_id_fkey";

-- DropIndex
DROP INDEX "turno_excepcion_turno_reemplazo_id_idx";

-- AlterTable
ALTER TABLE "turno_excepcion" DROP COLUMN "turno_reemplazo_id";
