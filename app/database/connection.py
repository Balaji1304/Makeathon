import logging
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.exc import ProgrammingError

from app.config import settings

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.database_url,
    echo=settings.db_echo,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _grant_public_schema_via_admin() -> None:
    admin = create_engine(settings.admin_database_url, isolation_level="AUTOCOMMIT")
    user, db = settings.db_user, settings.db_name
    with admin.connect() as conn:
        conn.execute(text(f'GRANT ALL ON SCHEMA public TO "{user}"'))
        conn.execute(text(f'GRANT ALL ON DATABASE "{db}" TO "{user}"'))
    admin.dispose()
    logger.info("Granted schema public and database to %s via admin connection", user)


def init_db() -> None:
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized")
    except ProgrammingError as e:
        msg = str(e.orig) if getattr(e, "orig", None) else str(e)
        if "permission denied" not in msg or "schema public" not in msg:
            raise
        if settings.admin_database_url:
            _grant_public_schema_via_admin()
            Base.metadata.create_all(bind=engine)
            logger.info("Database tables initialized after schema grant")
            return
        script = Path(__file__).resolve().parent.parent.parent / "scripts" / "grant_public_schema.sql"
        raise RuntimeError(
            "Permission denied for schema public. Run once as postgres:\n"
            f'  psql -U postgres -d {settings.db_name} -c "GRANT ALL ON SCHEMA public TO {settings.db_user}; GRANT ALL ON DATABASE {settings.db_name} TO {settings.db_user};"\n'
            f"Or: psql -U postgres -d {settings.db_name} -f {script}"
        ) from e


def reset_db() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables dropped and recreated")
