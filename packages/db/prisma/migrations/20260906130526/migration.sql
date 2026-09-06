-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "unicamp_data_portal"."data_portal_career_code" ADD VALUE 'B3';
ALTER TYPE "unicamp_data_portal"."data_portal_career_code" ADD VALUE 'B4';
ALTER TYPE "unicamp_data_portal"."data_portal_career_code" ADD VALUE 'E';

-- AlterEnum
ALTER TYPE "unicamp_data_portal"."data_portal_position_category" ADD VALUE 'MTS-B';

-- AlterEnum
ALTER TYPE "unicamp_data_portal"."data_portal_professor_rank" ADD VALUE 'Docente em Ensino de Línguas II';
