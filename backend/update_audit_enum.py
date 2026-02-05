import asyncio
from sqlalchemy import text
from app.core.database import engine

async def update_enum():
    async with engine.begin() as conn:
        try:
            # Verificar si el valor ya existe
            result = await conn.execute(text("""
                SELECT EXISTS (
                    SELECT 1 FROM pg_enum 
                    WHERE enumlabel = 'reset_password' 
                    AND enumtypid = (
                        SELECT oid FROM pg_type WHERE typname = 'auditaction'
                    )
                );
            """))
            exists = result.scalar()
            
            if not exists:
                # Agregar el nuevo valor al enum
                await conn.execute(text(
                    "ALTER TYPE auditaction ADD VALUE 'reset_password';"
                ))
                print("✅ Enum actualizado: se agregó 'reset_password'")
            else:
                print("ℹ️ El valor 'reset_password' ya existe en el enum")
                
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(update_enum())
