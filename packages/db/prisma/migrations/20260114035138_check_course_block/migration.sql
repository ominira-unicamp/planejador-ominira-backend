ALTER TABLE "CourseBlock" 
    ADD CONSTRAINT "CourseBlock_only_one_parent_fk" 
    CHECK (("catalogLanguageId" IS NOT NULL AND "catalogSpecializationId" IS NULL AND "catalogProgramId" IS NULL)
        OR ("catalogLanguageId" IS NULL AND "catalogSpecializationId" IS NOT NULL AND "catalogProgramId" IS NULL)
        OR ("catalogLanguageId" IS NULL AND "catalogSpecializationId" IS NULL AND "catalogProgramId" IS NOT NULL)
    )