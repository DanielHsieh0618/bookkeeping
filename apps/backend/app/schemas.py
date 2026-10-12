from datetime import date
from decimal import Decimal
from typing import Annotated

from dateutil import parser as date_parser
from pydantic import BaseModel, Field, field_validator


def format_date(value: date) -> str:
    return f"{value.strftime('%a %b')} {value.day} {value.year}"


def to_date_string(value: str) -> str:
    return format_date(date_parser.parse(value))


class UserOut(BaseModel):
    user_id: int
    google_id: str
    email: str
    user_name: str
    uuid: str


class CategoryOut(BaseModel):
    category_id: int
    user_id: int
    category_name: str
    category_icon: str


class RecordOut(BaseModel):
    record_id: int
    record_date: str
    record_type: str
    amount: float
    category_id: int | None
    user_id: int
    description: str

    # record_date is VARCHAR in schema.sql but a DATE column in the original production database.
    @field_validator("record_date", mode="before")
    @classmethod
    def format_date_column(cls, value: object) -> object:
        return format_date(value) if isinstance(value, date) else value


class RecordCreate(BaseModel):
    recordDate: str
    recordType: str
    amount: Annotated[Decimal, Field(max_digits=12, decimal_places=2)]
    categoryId: int | None = None
    description: str = ""

    @field_validator("recordDate")
    @classmethod
    def normalize_record_date(cls, value: str) -> str:
        return to_date_string(value)


class GlobalRecordCreate(RecordCreate):
    userId: int


class BootstrapUser(BaseModel):
    googleId: str
    email: str
    userName: str


class Message(BaseModel):
    message: str
