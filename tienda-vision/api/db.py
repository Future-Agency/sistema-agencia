from __future__ import annotations

from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .settings import get_settings


class Base(DeclarativeBase):
    pass


@lru_cache
def get_engine():
    url = get_settings().database_url
    kwargs = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {"pool_pre_ping": True}
    return create_engine(url, **kwargs)


@lru_cache
def get_sessionmaker():
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def init_db() -> None:
    from . import models  # noqa: F401  registra las tablas

    Base.metadata.create_all(get_engine())


def get_db():
    db: Session = get_sessionmaker()()
    try:
        yield db
    finally:
        db.close()
