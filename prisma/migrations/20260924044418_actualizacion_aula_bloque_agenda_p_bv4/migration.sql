/*
  Warnings:

  - Added the required column `aula_id` to the `bloque_agenda` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "bloque_agenda" ADD COLUMN     "aula_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "aula" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "capacidad" INTEGER NOT NULL,
    "estado" "Estado" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "aula_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aula_nombre_key" ON "aula"("nombre");

-- CreateIndex
CREATE INDEX "bloque_agenda_aula_id_idx" ON "bloque_agenda"("aula_id");

-- CreateIndex
CREATE INDEX "bloque_agenda_aula_id_dia_semana_idx" ON "bloque_agenda"("aula_id", "dia_semana");

-- AddForeignKey
ALTER TABLE "bloque_agenda" ADD CONSTRAINT "bloque_agenda_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "aula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
