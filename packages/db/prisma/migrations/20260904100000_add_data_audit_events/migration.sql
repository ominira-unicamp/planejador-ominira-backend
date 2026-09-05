-- CreateEnum
CREATE TYPE "data"."DataAuditOperation" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "data"."DataAuditEvent" (
    "id" BIGSERIAL NOT NULL,
    "schemaName" VARCHAR(63) NOT NULL,
    "tableName" VARCHAR(63) NOT NULL,
    "recordKey" JSONB NOT NULL,
    "operation" "data"."DataAuditOperation" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "auditContext" JSONB,
    "runId" UUID,
    "injectionName" VARCHAR(100),
    "transactionId" BIGINT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataAuditEvent_schemaName_tableName_occurredAt_idx" ON "data"."DataAuditEvent"("schemaName", "tableName", "occurredAt");

-- CreateIndex
CREATE INDEX "DataAuditEvent_runId_occurredAt_idx" ON "data"."DataAuditEvent"("runId", "occurredAt");

CREATE FUNCTION "data"."captureDataAuditEvent"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    before_row JSONB;
    after_row JSONB;
    current_row JSONB;
    context_value JSONB;
    context_text TEXT;
    record_key JSONB;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD IS NOT DISTINCT FROM NEW THEN
        RETURN NULL;
    END IF;

    before_row := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
    after_row := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END;
    current_row := COALESCE(after_row, before_row);
    record_key := CASE
        WHEN current_row ? 'id' THEN jsonb_build_object('id', current_row -> 'id')
        ELSE current_row
    END;
    context_text := current_setting('pomi.audit_context', true);
    context_value := CASE
        WHEN context_text IS NULL OR context_text = '' THEN jsonb_build_object(
            'source', 'unknown',
            'databaseUser', current_user,
            'applicationName', current_setting('application_name', true)
        )
        ELSE context_text::JSONB
    END;

    INSERT INTO "data"."DataAuditEvent" (
        "schemaName",
        "tableName",
        "recordKey",
        "operation",
        "before",
        "after",
        "auditContext",
        "runId",
        "injectionName",
        "transactionId",
        "occurredAt"
    ) VALUES (
        TG_TABLE_SCHEMA,
        TG_TABLE_NAME,
        record_key,
        CASE TG_OP
            WHEN 'INSERT' THEN 'CREATE'::"data"."DataAuditOperation"
            WHEN 'UPDATE' THEN 'UPDATE'::"data"."DataAuditOperation"
            ELSE 'DELETE'::"data"."DataAuditOperation"
        END,
        before_row,
        after_row,
        context_value,
        NULLIF(context_value ->> 'runId', '')::UUID,
        NULLIF(context_value ->> 'injectionName', ''),
        txid_current(),
        clock_timestamp()
    );

    RETURN NULL;
END;
$$;

DO $$
DECLARE
    target RECORD;
BEGIN
    FOR target IN
        SELECT relation.relname
        FROM pg_class AS relation
        INNER JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'data'
          AND relation.relkind = 'r'
          AND relation.relname <> 'DataAuditEvent'
    LOOP
        EXECUTE format(
            'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION "data"."captureDataAuditEvent"()',
            'captureDataAuditEvent',
            'data',
            target.relname
        );
    END LOOP;
END;
$$;
