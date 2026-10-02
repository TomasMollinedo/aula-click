-- AlterTable
ALTER TABLE "turno" ADD COLUMN     "serie_id" UUID;

-- CreateIndex
CREATE INDEX "turno_serie_id_idx" ON "turno"("serie_id");
