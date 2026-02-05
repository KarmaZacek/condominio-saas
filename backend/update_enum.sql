-- Agregar el valor al enum si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'reset_password' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'auditaction')
    ) THEN
        ALTER TYPE auditaction ADD VALUE 'reset_password';
        RAISE NOTICE 'Valor reset_password agregado al enum';
    ELSE
        RAISE NOTICE 'El valor reset_password ya existe';
    END IF;
END
$$;

-- Verificar todos los valores del enum
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'auditaction')
ORDER BY enumsortorder;
