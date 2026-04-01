#!/usr/bin/env python3
"""
Smart database initialization script.
Checks if tables already exist and only loads data if needed.
"""
import sys
import logging
from pathlib import Path
from sqlalchemy import inspect
from hex_db_loader import (
    get_db_engine,
    load_geojson,
    load_metadata,
    load_connectivity,
    GEO_TABLE_NAME,
    METADATA_TABLE_NAME,
    CONNECTIVITY_TABLE_NAME,
    SCHEMA,
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    # Connect to database
    logger.info("Connecting to database...")
    engine = get_db_engine()

    # Check for completion marker (fast, atomic check)
    from sqlalchemy import text
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = '_db_init_complete'
            )
        """)).scalar()

        if result:
            logger.info("Found completion marker. Database already initialized.")
            logger.info("To force re-initialization: DROP TABLE _db_init_complete;")
            sys.exit(0)

    logger.info("No completion marker found. Starting database initialization...")

    # Clean up any partial data from previous failed attempts
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    tables_to_clean = [GEO_TABLE_NAME, METADATA_TABLE_NAME, CONNECTIVITY_TABLE_NAME]

    if any(table in existing_tables for table in tables_to_clean):
        logger.info("Found existing data tables. Cleaning up partial data...")
        with engine.begin() as conn:
            for table in tables_to_clean:
                if table in existing_tables:
                    conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
        logger.info("Cleanup complete. Starting fresh load...")

    # Load all data (tables either don't exist or were truncated)
    logger.info("Loading hexagon geometries...")
    gdf = load_geojson(engine)
    logger.info(f"Hexagon geometries loaded: {len(gdf)} features")

    logger.info("Loading metadata...")
    df = load_metadata(engine)
    logger.info(f"Metadata loaded: {len(df)} records")

    data_dir = Path(__file__).parent / "data"
    pq_files = sorted(data_dir.glob("connectivity_*.pq"))
    if not pq_files:
        raise FileNotFoundError(f"No connectivity_*.pq files found in {data_dir}")
    logger.info(f"Loading connectivity data from {len(pq_files)} files...")
    for pq_file in pq_files:
        logger.info(f"  Loading {pq_file.name}...")
        load_connectivity(engine, data_path=pq_file)

    logger.info("Building connectivity indices and running ANALYZE...")
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text(f'''
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_connect_dtr_inc
            ON "{SCHEMA}"."{CONNECTIVITY_TABLE_NAME}" (depth, time_range, start_id)
            INCLUDE (end_id, weight);
        '''))
        conn.execute(text(f'''
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_connect_dtr_inc_reverse
            ON "{SCHEMA}"."{CONNECTIVITY_TABLE_NAME}" (depth, time_range, end_id)
            INCLUDE (start_id, weight);
        '''))
        conn.execute(text(f'ANALYZE "{SCHEMA}"."{CONNECTIVITY_TABLE_NAME}";'))
    logger.info("Connectivity data loaded with indices and ANALYZE")

    # Mark initialization as complete
    logger.info("Creating completion marker...")
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE _db_init_complete (
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'complete'
            )
        """))
        conn.execute(text("INSERT INTO _db_init_complete DEFAULT VALUES"))

    logger.info("Database initialization complete!")

except Exception as e:
    logger.error(f"ERROR during initialization: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
