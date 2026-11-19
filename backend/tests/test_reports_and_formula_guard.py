"""Unit tests for Formula Injection protection and Reports business rules."""
import pytest
from app.modules.reports.formula_guard import sanitize_cell_value, generate_safe_csv


def test_sanitize_cell_value_neutralizes_unsafe_prefixes():
    """Verify CWE-1236 formula injection sanitization on unsafe prefixes."""
    # Unsafe spreadsheet formulas
    assert sanitize_cell_value("=1+1") == "'=1+1"
    assert sanitize_cell_value("=SUM(A1:A10)") == "'=SUM(A1:A10)"
    assert sanitize_cell_value("+2+2") == "'+2+2"
    assert sanitize_cell_value("-10-5") == "'-10-5"
    assert sanitize_cell_value("@SUM(A1)") == "'@SUM(A1)"
    assert sanitize_cell_value("\tcmd|' /C calc'!A0") == "'\tcmd|' /C calc'!A0"
    assert sanitize_cell_value("\r=cmd|' /C calc'!A0") == "'\r=cmd|' /C calc'!A0"
    assert sanitize_cell_value("   =1+1") == "'   =1+1"
    assert sanitize_cell_value("   +2+2") == "'   +2+2"
    assert sanitize_cell_value("  -10-5") == "'  -10-5"
    assert sanitize_cell_value(" \t  @SUM(B2)") == "' \t  @SUM(B2)"
    assert sanitize_cell_value("\n=SUM(A1:A10)") == "'\n=SUM(A1:A10)"

    # Safe strings and values
    assert sanitize_cell_value("બોટાદ") == "બોટાદ"
    assert sanitize_cell_value("FMD") == "FMD"
    assert sanitize_cell_value("Regular Text") == "Regular Text"
    assert sanitize_cell_value(12345) == 12345
    assert sanitize_cell_value(0) == 0
    assert sanitize_cell_value(None) == ""


def test_generate_safe_csv_output():
    """Verify that generated CSV includes UTF-8 BOM and sanitizes rows."""
    headers = ["ગામનું નામ", "ફોર્મ્યુલા ટેસ્ટ", "પશુ સંખ્યા"]
    rows = [
        ["બોટાદ", "=2+5", 150],
        ["રામપરા", "+HYPERLINK(\"http://evil.com\")", 80],
        ["તુરખા", "સામાન્ય ટેક્સ્ટ", 210],
    ]

    csv_output = generate_safe_csv(headers, rows)

    # Must contain UTF-8 BOM
    assert csv_output.startswith("\ufeff")

    # Unsafe cells must be prepended with single quote
    assert "'=2+5" in csv_output
    assert "'+HYPERLINK" in csv_output

    # Safe text preserved
    assert "સામાન્ય ટેક્સ્ટ" in csv_output
    assert "બોટાદ" in csv_output

