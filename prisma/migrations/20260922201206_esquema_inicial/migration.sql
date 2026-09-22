-- CreateEnum
CREATE TYPE "Estado" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "NivelEscolaridad" AS ENUM ('INICIAL', 'PRIMARIO', 'SECUNDARIO', 'TERCIARIO', 'UNIVERSITARIO');

-- CreateEnum
CREATE TYPE "TipoTurno" AS ENUM ('RECURRENTE', 'SESION_UNICA');

-- CreateEnum
CREATE TYPE "EstadoTurno" AS ENUM ('ACTIVO', 'CANCELADO');

-- CreateTable
CREATE TABLE "rol" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "Estado" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "busqueda" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "rol_id" TEXT NOT NULL,
    "avatar_key" TEXT,
    "avatar_mime_type" TEXT,
    "avatar_updated_at" TIMESTAMP(3),
    "estado" "Estado" NOT NULL DEFAULT 'ACTIVO',
    "usuario_creador_id" TEXT,
    "usuario_modificador_id" TEXT,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_hora_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profesor" (
    "id" SERIAL NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,

    CONSTRAINT "profesor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alumno" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "busqueda" TEXT NOT NULL,
    "fecha_nacimiento" DATE NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tutor_nombre" TEXT,
    "tutor_apellido" TEXT,
    "tutor_dni" TEXT,
    "tutor_telefono" TEXT,
    "tutor_email" TEXT,
    "nivel_escolaridad" "NivelEscolaridad",
    "grado" TEXT,
    "institucion_educativa" TEXT,
    "observaciones" TEXT,
    "estado" "Estado" NOT NULL DEFAULT 'ACTIVO',
    "usuario_creador_id" TEXT NOT NULL,
    "usuario_modificador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_hora_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alumno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materia" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "busqueda" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "Estado" NOT NULL DEFAULT 'ACTIVO',
    "usuario_creador_id" TEXT NOT NULL,
    "usuario_modificador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_hora_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignacion_materia" (
    "id" SERIAL NOT NULL,
    "profesor_id" INTEGER NOT NULL,
    "materia_id" INTEGER NOT NULL,
    "estado" "Estado" NOT NULL DEFAULT 'ACTIVO',
    "usuario_creador_id" TEXT NOT NULL,
    "usuario_modificador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_hora_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asignacion_materia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloque_agenda" (
    "id" SERIAL NOT NULL,
    "profesor_id" INTEGER NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "hora_inicio" INTEGER NOT NULL,
    "hora_fin" INTEGER NOT NULL,
    "capacidad" INTEGER NOT NULL,
    "estado" "Estado" NOT NULL DEFAULT 'ACTIVO',
    "usuario_creador_id" TEXT NOT NULL,
    "usuario_modificador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_hora_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bloque_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turno" (
    "id" SERIAL NOT NULL,
    "bloque_agenda_id" INTEGER NOT NULL,
    "alumno_id" INTEGER NOT NULL,
    "materia_id" INTEGER NOT NULL,
    "tipo" "TipoTurno" NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "motivo_consulta" TEXT,
    "estado" "EstadoTurno" NOT NULL DEFAULT 'ACTIVO',
    "usuario_creador_id" TEXT NOT NULL,
    "usuario_modificador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_hora_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turno_excepcion" (
    "id" SERIAL NOT NULL,
    "turno_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "turno_reemplazo_id" INTEGER,
    "usuario_creador_id" TEXT NOT NULL,
    "usuario_modificador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_hora_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turno_excepcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "examen_materia" (
    "id" SERIAL NOT NULL,
    "alumno_id" INTEGER NOT NULL,
    "materia_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "usuario_creador_id" TEXT NOT NULL,
    "usuario_modificador_id" TEXT NOT NULL,
    "fecha_hora_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_hora_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "examen_materia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_dni_key" ON "usuario"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_apellido_idx" ON "usuario"("apellido");

-- CreateIndex
CREATE INDEX "usuario_busqueda_idx" ON "usuario"("busqueda");

-- CreateIndex
CREATE INDEX "usuario_rol_id_idx" ON "usuario"("rol_id");

-- CreateIndex
CREATE INDEX "usuario_usuario_creador_id_idx" ON "usuario"("usuario_creador_id");

-- CreateIndex
CREATE INDEX "usuario_usuario_modificador_id_idx" ON "usuario"("usuario_modificador_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_usuario_id_idx" ON "session"("usuario_id");

-- CreateIndex
CREATE INDEX "account_usuario_id_idx" ON "account"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_provider_id_account_id_key" ON "account"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "profesor_usuario_id_key" ON "profesor"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "profesor_matricula_key" ON "profesor"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "alumno_dni_key" ON "alumno"("dni");

-- CreateIndex
CREATE INDEX "alumno_apellido_idx" ON "alumno"("apellido");

-- CreateIndex
CREATE INDEX "alumno_busqueda_idx" ON "alumno"("busqueda");

-- CreateIndex
CREATE INDEX "alumno_usuario_creador_id_idx" ON "alumno"("usuario_creador_id");

-- CreateIndex
CREATE INDEX "alumno_usuario_modificador_id_idx" ON "alumno"("usuario_modificador_id");

-- CreateIndex
CREATE UNIQUE INDEX "materia_busqueda_key" ON "materia"("busqueda");

-- CreateIndex
CREATE INDEX "materia_usuario_creador_id_idx" ON "materia"("usuario_creador_id");

-- CreateIndex
CREATE INDEX "materia_usuario_modificador_id_idx" ON "materia"("usuario_modificador_id");

-- CreateIndex
CREATE INDEX "asignacion_materia_materia_id_idx" ON "asignacion_materia"("materia_id");

-- CreateIndex
CREATE INDEX "asignacion_materia_usuario_creador_id_idx" ON "asignacion_materia"("usuario_creador_id");

-- CreateIndex
CREATE INDEX "asignacion_materia_usuario_modificador_id_idx" ON "asignacion_materia"("usuario_modificador_id");

-- CreateIndex
CREATE UNIQUE INDEX "asignacion_materia_profesor_id_materia_id_key" ON "asignacion_materia"("profesor_id", "materia_id");

-- CreateIndex
CREATE INDEX "bloque_agenda_profesor_id_dia_semana_idx" ON "bloque_agenda"("profesor_id", "dia_semana");

-- CreateIndex
CREATE INDEX "bloque_agenda_usuario_creador_id_idx" ON "bloque_agenda"("usuario_creador_id");

-- CreateIndex
CREATE INDEX "bloque_agenda_usuario_modificador_id_idx" ON "bloque_agenda"("usuario_modificador_id");

-- CreateIndex
CREATE INDEX "turno_bloque_agenda_id_fecha_inicio_idx" ON "turno"("bloque_agenda_id", "fecha_inicio");

-- CreateIndex
CREATE INDEX "turno_alumno_id_idx" ON "turno"("alumno_id");

-- CreateIndex
CREATE INDEX "turno_materia_id_idx" ON "turno"("materia_id");

-- CreateIndex
CREATE INDEX "turno_usuario_creador_id_idx" ON "turno"("usuario_creador_id");

-- CreateIndex
CREATE INDEX "turno_usuario_modificador_id_idx" ON "turno"("usuario_modificador_id");

-- CreateIndex
CREATE INDEX "turno_excepcion_turno_reemplazo_id_idx" ON "turno_excepcion"("turno_reemplazo_id");

-- CreateIndex
CREATE INDEX "turno_excepcion_usuario_creador_id_idx" ON "turno_excepcion"("usuario_creador_id");

-- CreateIndex
CREATE INDEX "turno_excepcion_usuario_modificador_id_idx" ON "turno_excepcion"("usuario_modificador_id");

-- CreateIndex
CREATE UNIQUE INDEX "turno_excepcion_turno_id_fecha_key" ON "turno_excepcion"("turno_id", "fecha");

-- CreateIndex
CREATE INDEX "examen_materia_materia_id_idx" ON "examen_materia"("materia_id");

-- CreateIndex
CREATE INDEX "examen_materia_usuario_creador_id_idx" ON "examen_materia"("usuario_creador_id");

-- CreateIndex
CREATE INDEX "examen_materia_usuario_modificador_id_idx" ON "examen_materia"("usuario_modificador_id");

-- CreateIndex
CREATE UNIQUE INDEX "examen_materia_alumno_id_materia_id_fecha_key" ON "examen_materia"("alumno_id", "materia_id", "fecha");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_usuario_modificador_id_fkey" FOREIGN KEY ("usuario_modificador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profesor" ADD CONSTRAINT "profesor_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumno" ADD CONSTRAINT "alumno_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumno" ADD CONSTRAINT "alumno_usuario_modificador_id_fkey" FOREIGN KEY ("usuario_modificador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materia" ADD CONSTRAINT "materia_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materia" ADD CONSTRAINT "materia_usuario_modificador_id_fkey" FOREIGN KEY ("usuario_modificador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_materia" ADD CONSTRAINT "asignacion_materia_profesor_id_fkey" FOREIGN KEY ("profesor_id") REFERENCES "profesor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_materia" ADD CONSTRAINT "asignacion_materia_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_materia" ADD CONSTRAINT "asignacion_materia_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_materia" ADD CONSTRAINT "asignacion_materia_usuario_modificador_id_fkey" FOREIGN KEY ("usuario_modificador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloque_agenda" ADD CONSTRAINT "bloque_agenda_profesor_id_fkey" FOREIGN KEY ("profesor_id") REFERENCES "profesor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloque_agenda" ADD CONSTRAINT "bloque_agenda_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloque_agenda" ADD CONSTRAINT "bloque_agenda_usuario_modificador_id_fkey" FOREIGN KEY ("usuario_modificador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_bloque_agenda_id_fkey" FOREIGN KEY ("bloque_agenda_id") REFERENCES "bloque_agenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_usuario_modificador_id_fkey" FOREIGN KEY ("usuario_modificador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno_excepcion" ADD CONSTRAINT "turno_excepcion_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno_excepcion" ADD CONSTRAINT "turno_excepcion_turno_reemplazo_id_fkey" FOREIGN KEY ("turno_reemplazo_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno_excepcion" ADD CONSTRAINT "turno_excepcion_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno_excepcion" ADD CONSTRAINT "turno_excepcion_usuario_modificador_id_fkey" FOREIGN KEY ("usuario_modificador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examen_materia" ADD CONSTRAINT "examen_materia_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examen_materia" ADD CONSTRAINT "examen_materia_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examen_materia" ADD CONSTRAINT "examen_materia_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examen_materia" ADD CONSTRAINT "examen_materia_usuario_modificador_id_fkey" FOREIGN KEY ("usuario_modificador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
