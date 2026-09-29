/*
  Warnings:

  - You are about to drop the column `motivo_consulta` on the `turno` table. All the data in the column will be lost.
  - You are about to drop the `examen_materia` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "MotivoCancelacion" AS ENUM ('CANCELACION_ALUMNO', 'CANCELACION_PROFESOR', 'PROBLEMA_ADMINISTRATIVO', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoExamen" AS ENUM ('PARCIAL', 'FINAL', 'RECUPERATORIO', 'TRABAJO_PRACTICO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('VIGENTE', 'ANULADO');

-- DropForeignKey
ALTER TABLE "examen_materia" DROP CONSTRAINT "examen_materia_alumno_id_fkey";

-- DropForeignKey
ALTER TABLE "examen_materia" DROP CONSTRAINT "examen_materia_materia_id_fkey";

-- DropForeignKey
ALTER TABLE "examen_materia" DROP CONSTRAINT "examen_materia_usuario_creador_id_fkey";

-- DropForeignKey
ALTER TABLE "examen_materia" DROP CONSTRAINT "examen_materia_usuario_modificador_id_fkey";

-- AlterTable
ALTER TABLE "alumno" ALTER COLUMN "telefono" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "materia" ADD COLUMN     "precio_hora" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "turno" DROP COLUMN "motivo_consulta",
ADD COLUMN     "observaciones" TEXT,
ADD COLUMN     "temas" TEXT;

-- DropTable
DROP TABLE "examen_materia";

-- CreateTable
CREATE TABLE "examen" (
    "id" SERIAL NOT NULL,
    "alumno_id" INTEGER NOT NULL,
    "materia_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" "TipoExamen" NOT NULL,
    "observaciones" VARCHAR(500),
    "estado" "Estado" NOT NULL DEFAULT 'ACTIVO',
    "usuario_creador_id" TEXT NOT NULL,
    "usuario_modificador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_hora_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "examen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cancelacion_turno" (
    "id" SERIAL NOT NULL,
    "turno_id" INTEGER NOT NULL,
    "fecha_ocurrencia" DATE NOT NULL,
    "motivo" "MotivoCancelacion" NOT NULL,
    "detalle" VARCHAR(500),
    "usuario_creador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cancelacion_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finalizacion_recurrencia" (
    "id" SERIAL NOT NULL,
    "turno_id" INTEGER NOT NULL,
    "fecha_desde" DATE NOT NULL,
    "motivo" "MotivoCancelacion" NOT NULL,
    "detalle" VARCHAR(500),
    "usuario_creador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finalizacion_recurrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reprogramacion_turno" (
    "id" SERIAL NOT NULL,
    "turno_id" INTEGER NOT NULL,
    "fecha_origen" DATE NOT NULL,
    "bloque_agenda_origen_id" INTEGER NOT NULL,
    "fecha_destino" DATE NOT NULL,
    "bloque_agenda_destino_id" INTEGER NOT NULL,
    "usuario_creador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reprogramacion_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forma_pago" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" "Estado" NOT NULL DEFAULT 'ACTIVO',
    "usuario_creador_id" TEXT NOT NULL,
    "usuario_modificador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_hora_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forma_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago" (
    "id" SERIAL NOT NULL,
    "alumno_id" INTEGER NOT NULL,
    "forma_pago_id" INTEGER NOT NULL,
    "numero_comprobante" SERIAL NOT NULL,
    "importe_total" DECIMAL(10,2) NOT NULL,
    "fecha_pago" DATE NOT NULL,
    "monto_recibido" DECIMAL(10,2),
    "observaciones" VARCHAR(500),
    "estado" "EstadoPago" NOT NULL DEFAULT 'VIGENTE',
    "usuario_creador_id" TEXT NOT NULL,
    "usuario_modificador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_hora_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago_turno" (
    "id" SERIAL NOT NULL,
    "pago_id" INTEGER NOT NULL,
    "turno_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "importe_aplicado" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "pago_turno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "examen_alumno_id_materia_id_fecha_idx" ON "examen"("alumno_id", "materia_id", "fecha");

-- CreateIndex
CREATE INDEX "examen_materia_id_idx" ON "examen"("materia_id");

-- CreateIndex
CREATE INDEX "examen_usuario_creador_id_idx" ON "examen"("usuario_creador_id");

-- CreateIndex
CREATE INDEX "examen_usuario_modificador_id_idx" ON "examen"("usuario_modificador_id");

-- CreateIndex
CREATE INDEX "cancelacion_turno_usuario_creador_id_idx" ON "cancelacion_turno"("usuario_creador_id");

-- CreateIndex
CREATE UNIQUE INDEX "cancelacion_turno_turno_id_fecha_ocurrencia_key" ON "cancelacion_turno"("turno_id", "fecha_ocurrencia");

-- CreateIndex
CREATE UNIQUE INDEX "finalizacion_recurrencia_turno_id_key" ON "finalizacion_recurrencia"("turno_id");

-- CreateIndex
CREATE INDEX "finalizacion_recurrencia_usuario_creador_id_idx" ON "finalizacion_recurrencia"("usuario_creador_id");

-- CreateIndex
CREATE INDEX "reprogramacion_turno_turno_id_fecha_origen_idx" ON "reprogramacion_turno"("turno_id", "fecha_origen");

-- CreateIndex
CREATE INDEX "reprogramacion_turno_bloque_agenda_destino_id_fecha_destino_idx" ON "reprogramacion_turno"("bloque_agenda_destino_id", "fecha_destino");

-- CreateIndex
CREATE INDEX "reprogramacion_turno_usuario_creador_id_idx" ON "reprogramacion_turno"("usuario_creador_id");

-- CreateIndex
CREATE UNIQUE INDEX "forma_pago_nombre_key" ON "forma_pago"("nombre");

-- CreateIndex
CREATE INDEX "forma_pago_usuario_creador_id_idx" ON "forma_pago"("usuario_creador_id");

-- CreateIndex
CREATE INDEX "forma_pago_usuario_modificador_id_idx" ON "forma_pago"("usuario_modificador_id");

-- CreateIndex
CREATE UNIQUE INDEX "pago_numero_comprobante_key" ON "pago"("numero_comprobante");

-- CreateIndex
CREATE INDEX "pago_alumno_id_idx" ON "pago"("alumno_id");

-- CreateIndex
CREATE INDEX "pago_forma_pago_id_idx" ON "pago"("forma_pago_id");

-- CreateIndex
CREATE INDEX "pago_usuario_creador_id_idx" ON "pago"("usuario_creador_id");

-- CreateIndex
CREATE INDEX "pago_usuario_modificador_id_idx" ON "pago"("usuario_modificador_id");

-- CreateIndex
CREATE INDEX "pago_turno_pago_id_idx" ON "pago_turno"("pago_id");

-- CreateIndex
CREATE INDEX "pago_turno_turno_id_fecha_idx" ON "pago_turno"("turno_id", "fecha");

-- AddForeignKey
ALTER TABLE "examen" ADD CONSTRAINT "examen_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examen" ADD CONSTRAINT "examen_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examen" ADD CONSTRAINT "examen_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examen" ADD CONSTRAINT "examen_usuario_modificador_id_fkey" FOREIGN KEY ("usuario_modificador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancelacion_turno" ADD CONSTRAINT "cancelacion_turno_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancelacion_turno" ADD CONSTRAINT "cancelacion_turno_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finalizacion_recurrencia" ADD CONSTRAINT "finalizacion_recurrencia_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finalizacion_recurrencia" ADD CONSTRAINT "finalizacion_recurrencia_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reprogramacion_turno" ADD CONSTRAINT "reprogramacion_turno_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reprogramacion_turno" ADD CONSTRAINT "reprogramacion_turno_bloque_agenda_origen_id_fkey" FOREIGN KEY ("bloque_agenda_origen_id") REFERENCES "bloque_agenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reprogramacion_turno" ADD CONSTRAINT "reprogramacion_turno_bloque_agenda_destino_id_fkey" FOREIGN KEY ("bloque_agenda_destino_id") REFERENCES "bloque_agenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reprogramacion_turno" ADD CONSTRAINT "reprogramacion_turno_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forma_pago" ADD CONSTRAINT "forma_pago_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forma_pago" ADD CONSTRAINT "forma_pago_usuario_modificador_id_fkey" FOREIGN KEY ("usuario_modificador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_forma_pago_id_fkey" FOREIGN KEY ("forma_pago_id") REFERENCES "forma_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_usuario_modificador_id_fkey" FOREIGN KEY ("usuario_modificador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_turno" ADD CONSTRAINT "pago_turno_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_turno" ADD CONSTRAINT "pago_turno_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
