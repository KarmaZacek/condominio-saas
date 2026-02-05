"""
Script de migración para agregar campo is_advance_payment a transactions.
Ejecutar: python add_advance_payment_field.py
"""

import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate():
    """Agrega el campo is_advance_payment a la tabla transactions."""
    
    async with engine.begin() as conn:
        # Verificar si la columna ya existe
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'transactions' 
            AND column_name = 'is_advance_payment'
        """))
        
        exists = result.fetchone()
        
        if exists:
            print("✓ La columna 'is_advance_payment' ya existe")
        else:
            # Agregar la columna
            await conn.execute(text("""
                ALTER TABLE transactions 
                ADD COLUMN is_advance_payment BOOLEAN DEFAULT FALSE
            """))
            print("✓ Columna 'is_advance_payment' agregada")
            
            # Crear índice
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_transactions_advance 
                ON transactions (is_advance_payment) 
                WHERE is_advance_payment = TRUE
            """))
            print("✓ Índice creado para pagos adelantados")
            
            # Actualizar registros existentes
            # Marcar como adelantados los pagos donde fiscal_period > mes de transaction_date
            await conn.execute(text("""
                UPDATE transactions 
                SET is_advance_payment = TRUE 
                WHERE type = 'income' 
                AND fiscal_period > TO_CHAR(transaction_date, 'YYYY-MM')
                AND status = 'confirmed'
            """))
            print("✓ Pagos adelantados existentes actualizados")
        
        print("\n✅ Migración completada exitosamente")

if __name__ == "__main__":
    asyncio.run(migrate())
