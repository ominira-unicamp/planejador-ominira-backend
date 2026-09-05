-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "unicamp_data_portal";

-- CreateEnum
CREATE TYPE "unicamp_data_portal"."data_portal_career_code" AS ENUM ('A', 'C', 'C3', 'C4', 'C5', 'D', 'F', 'G', 'H', 'I', 'J', 'L', 'M', 'MS3', 'MS3.1', 'MS3.2', 'MS5.1', 'MS5.2', 'MS5.3', 'MS6', 'O');

-- CreateEnum
CREATE TYPE "unicamp_data_portal"."data_portal_professor_rank" AS ENUM ('Professor Associado', 'Professor Associado I', 'Professor Associado II', 'Professor Associado III', 'Professor Assistente', 'Professor Doutor', 'Professor Doutor I', 'Professor Doutor II', 'Professor Magistério Secundário Técnico II', 'Professor Magistério Secundário Técnico III', 'Professor Pleno', 'Professor Titular', 'PROF TITULAR-PS', 'PROFESSOR SENIOR', 'Docente em Ensino de Línguas I', 'Docente em Ensino de Línguas III', 'Docente em Educação Especial e Reabilitação V');

-- CreateEnum
CREATE TYPE "unicamp_data_portal"."data_portal_position_category" AS ENUM ('MA-I', 'MA-II', 'MA-III', 'MTS-C');

-- CreateEnum
CREATE TYPE "unicamp_data_portal"."data_portal_identifier_system" AS ENUM ('LATTES', 'ORCID', 'SCOPUS', 'WEB_OF_SCIENCE', 'PUBLONS', 'GOOGLE_SCHOLAR', 'SCIELO', 'FAPESP');

-- CreateEnum
CREATE TYPE "unicamp_data_portal"."data_portal_training_degree" AS ENUM ('POST_DOCTORATE', 'DOCTORATE', 'MASTER', 'UNDERGRADUATE');

-- CreateTable
CREATE TABLE "data"."Department" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "unitId" INTEGER NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unicamp_data_portal"."data_portal_professor_profile" (
    "id" SERIAL NOT NULL,
    "professorId" INTEGER NOT NULL,
    "portalId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "lattesAbstract" TEXT,
    "unitId" INTEGER NOT NULL,
    "departmentId" INTEGER,
    "positionId" INTEGER,

    CONSTRAINT "data_portal_professor_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unicamp_data_portal"."data_portal_position" (
    "id" SERIAL NOT NULL,
    "careerCode" "unicamp_data_portal"."data_portal_career_code",
    "rank" "unicamp_data_portal"."data_portal_professor_rank",
    "category" "unicamp_data_portal"."data_portal_position_category",

    CONSTRAINT "data_portal_position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unicamp_data_portal"."data_portal_external_identity" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "system" "unicamp_data_portal"."data_portal_identifier_system" NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "data_portal_external_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unicamp_data_portal"."data_portal_citation_name" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "data_portal_citation_name_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unicamp_data_portal"."data_portal_training" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "degree" "unicamp_data_portal"."data_portal_training_degree" NOT NULL,
    "institutionName" TEXT NOT NULL,
    "startYear" INTEGER,
    "endYear" INTEGER,

    CONSTRAINT "data_portal_training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unicamp_data_portal"."data_portal_keyword" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,

    CONSTRAINT "data_portal_keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unicamp_data_portal"."data_portal_professor_keyword" (
    "profileId" INTEGER NOT NULL,
    "keywordId" INTEGER NOT NULL,
    "count" INTEGER,

    CONSTRAINT "data_portal_professor_keyword_pkey" PRIMARY KEY ("profileId","keywordId")
);

-- CreateTable
CREATE TABLE "unicamp_data_portal"."data_portal_coauthor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,

    CONSTRAINT "data_portal_coauthor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unicamp_data_portal"."data_portal_professor_coauthor" (
    "profileId" INTEGER NOT NULL,
    "coauthorId" INTEGER NOT NULL,
    "count" INTEGER,

    CONSTRAINT "data_portal_professor_coauthor_pkey" PRIMARY KEY ("profileId","coauthorId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_unitId_name_key" ON "data"."Department"("unitId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "data_portal_professor_profile_professorId_key" ON "unicamp_data_portal"."data_portal_professor_profile"("professorId");

-- CreateIndex
CREATE UNIQUE INDEX "data_portal_professor_profile_portalId_key" ON "unicamp_data_portal"."data_portal_professor_profile"("portalId");

-- CreateIndex
CREATE INDEX "data_portal_professor_profile_unitId_idx" ON "unicamp_data_portal"."data_portal_professor_profile"("unitId");

-- CreateIndex
CREATE INDEX "data_portal_professor_profile_departmentId_idx" ON "unicamp_data_portal"."data_portal_professor_profile"("departmentId");

-- CreateIndex
CREATE INDEX "data_portal_professor_profile_positionId_idx" ON "unicamp_data_portal"."data_portal_professor_profile"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "data_portal_position_careerCode_rank_category_key" ON "unicamp_data_portal"."data_portal_position"("careerCode", "rank", "category");

-- CreateIndex
CREATE INDEX "data_portal_external_identity_system_externalId_idx" ON "unicamp_data_portal"."data_portal_external_identity"("system", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "data_portal_external_identity_profileId_system_externalId_key" ON "unicamp_data_portal"."data_portal_external_identity"("profileId", "system", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "data_portal_citation_name_profileId_name_key" ON "unicamp_data_portal"."data_portal_citation_name"("profileId", "name");

-- CreateIndex
CREATE INDEX "data_portal_training_profileId_idx" ON "unicamp_data_portal"."data_portal_training"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "data_portal_keyword_normalizedName_key" ON "unicamp_data_portal"."data_portal_keyword"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "data_portal_coauthor_normalizedName_key" ON "unicamp_data_portal"."data_portal_coauthor"("normalizedName");

-- AddForeignKey
ALTER TABLE "data"."Department" ADD CONSTRAINT "Department_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "data"."Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unicamp_data_portal"."data_portal_professor_profile" ADD CONSTRAINT "data_portal_professor_profile_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "data"."Professor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unicamp_data_portal"."data_portal_professor_profile" ADD CONSTRAINT "data_portal_professor_profile_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "data"."Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unicamp_data_portal"."data_portal_professor_profile" ADD CONSTRAINT "data_portal_professor_profile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "data"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unicamp_data_portal"."data_portal_professor_profile" ADD CONSTRAINT "data_portal_professor_profile_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "unicamp_data_portal"."data_portal_position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unicamp_data_portal"."data_portal_external_identity" ADD CONSTRAINT "data_portal_external_identity_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "unicamp_data_portal"."data_portal_professor_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unicamp_data_portal"."data_portal_citation_name" ADD CONSTRAINT "data_portal_citation_name_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "unicamp_data_portal"."data_portal_professor_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unicamp_data_portal"."data_portal_training" ADD CONSTRAINT "data_portal_training_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "unicamp_data_portal"."data_portal_professor_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unicamp_data_portal"."data_portal_professor_keyword" ADD CONSTRAINT "data_portal_professor_keyword_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "unicamp_data_portal"."data_portal_professor_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unicamp_data_portal"."data_portal_professor_keyword" ADD CONSTRAINT "data_portal_professor_keyword_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "unicamp_data_portal"."data_portal_keyword"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unicamp_data_portal"."data_portal_professor_coauthor" ADD CONSTRAINT "data_portal_professor_coauthor_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "unicamp_data_portal"."data_portal_professor_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unicamp_data_portal"."data_portal_professor_coauthor" ADD CONSTRAINT "data_portal_professor_coauthor_coauthorId_fkey" FOREIGN KEY ("coauthorId") REFERENCES "unicamp_data_portal"."data_portal_coauthor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
