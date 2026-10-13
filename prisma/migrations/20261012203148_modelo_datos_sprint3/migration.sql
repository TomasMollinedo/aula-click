/*
  Warnings:

  - A unique constraint covering the columns `[tipo_forma_pago]` on the table `forma_pago` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[turno_id,fecha_ocurrencia,vigente]` on the table `pago_turno` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `usuario` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[alumno_id]` on the table `usuario` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('PRESENTE', 'AUSENTE');

-- CreateEnum
CREATE TYPE "TipoFormaPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'DEBITO');

-- CreateEnum
CREATE TYPE "RedDebito" AS ENUM ('VISA_DEBITO', 'MASTERCARD_DEBITO', 'MAESTRO', 'CABAL_DEBITO', 'OTRA');

-- CreateEnum
CREATE TYPE "MotivoAnulacion" AS ENUM ('ERROR_CARGA', 'FORMA_PAGO_EQUIVOCADA', 'OTRO');

-- CreateEnum
CREATE TYPE "ResultadoExamen" AS ENUM ('CON_NOTA', 'AUSENTE');

-- DropIndex
DROP INDEX "pago_turno_turno_id_fecha_ocurrencia_key";

-- AlterTable
ALTER TABLE "account" ADD COLUMN     "contrasena_inicial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "contrasena_restablecida_fecha" TIMESTAMP(3),
ADD COLUMN     "contrasena_restablecida_por_id" TEXT;

-- AlterTable
ALTER TABLE "alumno" ADD COLUMN     "avatar_key" TEXT,
ADD COLUMN     "avatar_mime_type" TEXT,
ADD COLUMN     "avatar_updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "examen" ADD COLUMN     "nota" DECIMAL(4,2),
ADD COLUMN     "nota_fecha_hora_creacion" TIMESTAMP(3),
ADD COLUMN     "nota_fecha_hora_modificacion" TIMESTAMP(3),
ADD COLUMN     "nota_usuario_creador_id" TEXT,
ADD COLUMN     "nota_usuario_modificador_id" TEXT,
ADD COLUMN     "resultado" "ResultadoExamen";

-- AlterTable
ALTER TABLE "forma_pago" ADD COLUMN     "tipo_forma_pago" "TipoFormaPago";

-- AlterTable
ALTER TABLE "pago" ADD COLUMN     "debito_cupon" VARCHAR(20),
ADD COLUMN     "debito_red" "RedDebito",
ADD COLUMN     "debito_ultimos4" CHAR(4),
ADD COLUMN     "transferencia_banco" VARCHAR(100),
ADD COLUMN     "transferencia_operacion" VARCHAR(50),
ADD COLUMN     "transferencia_titular" VARCHAR(100);

-- AlterTable
ALTER TABLE "pago_turno" ADD COLUMN     "vigente" BOOLEAN DEFAULT true;

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "alumno_id" INTEGER,
ADD COLUMN     "display_username" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "asistencia_turno" (
    "id" SERIAL NOT NULL,
    "turno_id" INTEGER NOT NULL,
    "fecha_ocurrencia" DATE NOT NULL,
    "estado" "EstadoAsistencia" NOT NULL,
    "trabajado" VARCHAR(1000),
    "indicaciones" VARCHAR(1000),
    "observacion" VARCHAR(500),
    "usuario_creador_id" TEXT NOT NULL,
    "usuario_modificador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_hora_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asistencia_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobante_adjunto" (
    "id" SERIAL NOT NULL,
    "pago_id" INTEGER,
    "archivo_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "nombre_archivo" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "estado" "Estado" NOT NULL DEFAULT 'ACTIVO',
    "usuario_creador_id" TEXT NOT NULL,
    "usuario_modificador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_hora_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comprobante_adjunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anulacion_pago" (
    "id" SERIAL NOT NULL,
    "pago_id" INTEGER NOT NULL,
    "motivo" "MotivoAnulacion" NOT NULL,
    "detalle" VARCHAR(500),
    "usuario_creador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anulacion_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asistencia_turno_usuario_creador_id_idx" ON "asistencia_turno"("usuario_creador_id");

-- CreateIndex
CREATE INDEX "asistencia_turno_usuario_modificador_id_idx" ON "asistencia_turno"("usuario_modificador_id");

-- CreateIndex
CREATE UNIQUE INDEX "asistencia_turno_turno_id_fecha_ocurrencia_key" ON "asistencia_turno"("turno_id", "fecha_ocurrencia");

-- CreateIndex
CREATE INDEX "comprobante_adjunto_pago_id_idx" ON "comprobante_adjunto"("pago_id");

-- CreateIndex
CREATE INDEX "comprobante_adjunto_usuario_creador_id_idx" ON "comprobante_adjunto"("usuario_creador_id");

-- CreateIndex
CREATE INDEX "comprobante_adjunto_usuario_modificador_id_idx" ON "comprobante_adjunto"("usuario_modificador_id");

-- CreateIndex
CREATE UNIQUE INDEX "anulacion_pago_pago_id_key" ON "anulacion_pago"("pago_id");

-- CreateIndex
CREATE INDEX "anulacion_pago_usuario_creador_id_idx" ON "anulacion_pago"("usuario_creador_id");

-- CreateIndex
CREATE INDEX "account_contrasena_restablecida_por_id_idx" ON "account"("contrasena_restablecida_por_id");

-- CreateIndex
CREATE INDEX "examen_nota_usuario_creador_id_idx" ON "examen"("nota_usuario_creador_id");

-- CreateIndex
CREATE INDEX "examen_nota_usuario_modificador_id_idx" ON "examen"("nota_usuario_modificador_id");

-- CreateIndex
CREATE UNIQUE INDEX "forma_pago_tipo_forma_pago_key" ON "forma_pago"("tipo_forma_pago");

-- CreateIndex
CREATE INDEX "pago_transferencia_operacion_transferencia_banco_idx" ON "pago"("transferencia_operacion", "transferencia_banco");

-- CreateIndex
CREATE INDEX "pago_fecha_pago_idx" ON "pago"("fecha_pago");

-- CreateIndex
CREATE UNIQUE INDEX "pago_turno_turno_id_fecha_ocurrencia_vigente_key" ON "pago_turno"("turno_id", "fecha_ocurrencia", "vigente");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_username_key" ON "usuario"("username");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_alumno_id_key" ON "usuario"("alumno_id");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_contrasena_restablecida_por_id_fkey" FOREIGN KEY ("contrasena_restablecida_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examen" ADD CONSTRAINT "examen_nota_usuario_creador_id_fkey" FOREIGN KEY ("nota_usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examen" ADD CONSTRAINT "examen_nota_usuario_modificador_id_fkey" FOREIGN KEY ("nota_usuario_modificador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia_turno" ADD CONSTRAINT "asistencia_turno_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia_turno" ADD CONSTRAINT "asistencia_turno_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia_turno" ADD CONSTRAINT "asistencia_turno_usuario_modificador_id_fkey" FOREIGN KEY ("usuario_modificador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobante_adjunto" ADD CONSTRAINT "comprobante_adjunto_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobante_adjunto" ADD CONSTRAINT "comprobante_adjunto_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobante_adjunto" ADD CONSTRAINT "comprobante_adjunto_usuario_modificador_id_fkey" FOREIGN KEY ("usuario_modificador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anulacion_pago" ADD CONSTRAINT "anulacion_pago_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anulacion_pago" ADD CONSTRAINT "anulacion_pago_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
