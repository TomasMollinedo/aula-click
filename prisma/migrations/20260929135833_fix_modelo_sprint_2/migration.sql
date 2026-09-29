/*
  Warnings:

  - You are about to drop the column `fecha` on the `pago_turno` table. All the data in the column will be lost.
  - You are about to drop the `reprogramacion_turno` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[turno_id,fecha_ocurrencia]` on the table `pago_turno` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fecha_ocurrencia` to the `pago_turno` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "reprogramacion_turno" DROP CONSTRAINT "reprogramacion_turno_bloque_agenda_destino_id_fkey";

-- DropForeignKey
ALTER TABLE "reprogramacion_turno" DROP CONSTRAINT "reprogramacion_turno_bloque_agenda_origen_id_fkey";

-- DropForeignKey
ALTER TABLE "reprogramacion_turno" DROP CONSTRAINT "reprogramacion_turno_turno_id_fkey";

-- DropForeignKey
ALTER TABLE "reprogramacion_turno" DROP CONSTRAINT "reprogramacion_turno_usuario_creador_id_fkey";

-- DropIndex
DROP INDEX "pago_turno_turno_id_fecha_idx";

-- AlterTable
ALTER TABLE "pago_turno" DROP COLUMN "fecha",
ADD COLUMN     "fecha_ocurrencia" DATE NOT NULL;

-- DropTable
DROP TABLE "reprogramacion_turno";

-- CreateIndex
CREATE UNIQUE INDEX "pago_turno_turno_id_fecha_ocurrencia_key" ON "pago_turno"("turno_id", "fecha_ocurrencia");
