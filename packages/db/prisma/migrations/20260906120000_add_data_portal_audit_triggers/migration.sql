DO $$
DECLARE
    target RECORD;
    target_table REGCLASS;
BEGIN
    IF to_regprocedure('data."captureDataAuditEvent"()') IS NULL THEN
        RAISE EXCEPTION
            'A função data."captureDataAuditEvent"() precisa existir antes desta migration';
    END IF;

    FOR target IN
        SELECT
            relation.oid AS relation_oid,
            relation.relname
        FROM pg_class AS relation
        INNER JOIN pg_namespace AS namespace
            ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'unicamp_data_portal'
          AND relation.relkind = 'r'
    LOOP
        target_table := target.relation_oid::regclass;
        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgrelid = target.relation_oid
              AND tgname = 'captureDataAuditEvent'
              AND NOT tgisinternal
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION data."captureDataAuditEvent"()',
                'captureDataAuditEvent',
                target_table
            );
        END IF;
    END LOOP;
END;
$$;
