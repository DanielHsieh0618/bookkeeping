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
