/*
  Warnings:

  - Added the required column `porcentaje_centro` to the `pago_turno` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EstadoLiquidacion" AS ENUM ('PAGADA', 'DESCONTADA');

-- CreateEnum
CREATE TYPE "TipoAjusteLiquidacion" AS ENUM ('ANULACION', 'SALDO_ANTERIOR');

-- AlterTable
ALTER TABLE "comprobante_adjunto" ADD COLUMN     "liquidacion_id" INTEGER;

-- AlterTable
ALTER TABLE "pago_turno" ADD COLUMN     "porcentaje_centro" DECIMAL(5,2) NOT NULL;

-- CreateTable
CREATE TABLE "porcentaje_centro" (
    "id" SERIAL NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "usuario_creador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "porcentaje_centro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacion" (
    "id" SERIAL NOT NULL,
    "profesor_id" INTEGER NOT NULL,
    "mes" DATE NOT NULL,
    "estado" "EstadoLiquidacion" NOT NULL,
    "total_cobrado" DECIMAL(10,2) NOT NULL,
    "parte_centro" DECIMAL(10,2) NOT NULL,
    "parte_profesor" DECIMAL(10,2) NOT NULL,
    "total_ajustes" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "fecha_transferencia" DATE,
    "numero_operacion" VARCHAR(50),
    "observaciones" VARCHAR(500),
    "descontada_en_id" INTEGER,
    "usuario_creador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacion_turno" (
    "id" SERIAL NOT NULL,
    "liquidacion_id" INTEGER NOT NULL,
    "pago_turno_id" INTEGER NOT NULL,
    "fecha_devengo" DATE NOT NULL,
    "importe" DECIMAL(10,2) NOT NULL,
    "porcentaje_centro" DECIMAL(5,2) NOT NULL,
    "parte_profesor" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "liquidacion_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajuste_liquidacion" (
    "id" SERIAL NOT NULL,
    "liquidacion_id" INTEGER NOT NULL,
    "tipo" "TipoAjusteLiquidacion" NOT NULL,
    "importe" DECIMAL(10,2) NOT NULL,
    "liquidacion_turno_id" INTEGER,
    "liquidacion_origen_id" INTEGER,

    CONSTRAINT "ajuste_liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "porcentaje_centro_fecha_hora_creacion_idx" ON "porcentaje_centro"("fecha_hora_creacion");

-- CreateIndex
CREATE INDEX "porcentaje_centro_usuario_creador_id_idx" ON "porcentaje_centro"("usuario_creador_id");

-- CreateIndex
CREATE INDEX "liquidacion_fecha_transferencia_idx" ON "liquidacion"("fecha_transferencia");

-- CreateIndex
CREATE INDEX "liquidacion_descontada_en_id_idx" ON "liquidacion"("descontada_en_id");

-- CreateIndex
CREATE INDEX "liquidacion_usuario_creador_id_idx" ON "liquidacion"("usuario_creador_id");

-- CreateIndex
CREATE UNIQUE INDEX "liquidacion_profesor_id_mes_key" ON "liquidacion"("profesor_id", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "liquidacion_turno_pago_turno_id_key" ON "liquidacion_turno"("pago_turno_id");

-- CreateIndex
CREATE INDEX "liquidacion_turno_liquidacion_id_idx" ON "liquidacion_turno"("liquidacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "ajuste_liquidacion_liquidacion_turno_id_key" ON "ajuste_liquidacion"("liquidacion_turno_id");

-- CreateIndex
CREATE UNIQUE INDEX "ajuste_liquidacion_liquidacion_origen_id_key" ON "ajuste_liquidacion"("liquidacion_origen_id");

-- CreateIndex
CREATE INDEX "ajuste_liquidacion_liquidacion_id_idx" ON "ajuste_liquidacion"("liquidacion_id");

-- CreateIndex
CREATE INDEX "comprobante_adjunto_liquidacion_id_idx" ON "comprobante_adjunto"("liquidacion_id");

-- AddForeignKey
ALTER TABLE "comprobante_adjunto" ADD CONSTRAINT "comprobante_adjunto_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "liquidacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "porcentaje_centro" ADD CONSTRAINT "porcentaje_centro_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_profesor_id_fkey" FOREIGN KEY ("profesor_id") REFERENCES "profesor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_descontada_en_id_fkey" FOREIGN KEY ("descontada_en_id") REFERENCES "liquidacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_turno" ADD CONSTRAINT "liquidacion_turno_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "liquidacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_turno" ADD CONSTRAINT "liquidacion_turno_pago_turno_id_fkey" FOREIGN KEY ("pago_turno_id") REFERENCES "pago_turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajuste_liquidacion" ADD CONSTRAINT "ajuste_liquidacion_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "liquidacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajuste_liquidacion" ADD CONSTRAINT "ajuste_liquidacion_liquidacion_turno_id_fkey" FOREIGN KEY ("liquidacion_turno_id") REFERENCES "liquidacion_turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajuste_liquidacion" ADD CONSTRAINT "ajuste_liquidacion_liquidacion_origen_id_fkey" FOREIGN KEY ("liquidacion_origen_id") REFERENCES "liquidacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
