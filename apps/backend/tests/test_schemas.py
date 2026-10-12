import pytest

from app.schemas import to_date_string


@pytest.mark.parametrize(
    "value,expected",
    [
        ("2026-01-05", "Mon Jan 5 2026"),
        ("Mon Jan 5 2026", "Mon Jan 5 2026"),
    ],
)
def test_to_date_string_matches_js_todatestring_format(value, expected):
    assert to_date_string(value) == expected


def test_record_out_formats_a_date_column_like_a_stored_date_string():
    from datetime import date

    from app.schemas import RecordOut

    record = RecordOut.model_validate(
        {
            "record_id": 1,
            "record_date": date(2026, 1, 5),
            "record_type": "expenses",
            "amount": 4,
            "category_id": None,
            "user_id": 1,
            "description": "",
        }
    )
    assert record.record_date == "Mon Jan 5 2026"
