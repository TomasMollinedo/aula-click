-- El examen ya no tiene tipo (parcial, final, recuperatorio, trabajo práctico u otro): todos son
-- "evaluación" (decisión T-170). Se borra la columna y el enum; los exámenes y sus notas quedan.

-- AlterTable
ALTER TABLE "examen" DROP COLUMN "tipo";

-- DropEnum
DROP TYPE "TipoExamen";
