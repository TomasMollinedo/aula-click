/*
  Warnings:

  - You are about to drop the `turno_excepcion` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "turno_excepcion" DROP CONSTRAINT "turno_excepcion_turno_id_fkey";

-- DropForeignKey
ALTER TABLE "turno_excepcion" DROP CONSTRAINT "turno_excepcion_usuario_creador_id_fkey";

-- DropForeignKey
ALTER TABLE "turno_excepcion" DROP CONSTRAINT "turno_excepcion_usuario_modificador_id_fkey";

-- DropTable
DROP TABLE "turno_excepcion";
