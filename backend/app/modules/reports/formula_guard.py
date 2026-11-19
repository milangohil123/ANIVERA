"""Formula injection neutralization utilities for safe spreadsheet export.

Protects against CSV/Formula Injection (CWE-1236):
If any cell value starts with '=', '+', '-', '@', '\\t', or '\\r',
the value is escaped by prepending a single quote (').
"""
import io
import csv
from typing import Any, List, Sequence


UNSAFE_PREFIXES = ("=", "+", "-", "@", "\t", "\r")
DANGEROUS_FORMULA_STARTS = ("=", "+", "-", "@")


def sanitize_cell_value(val: Any) -> Any:
    """Neutralize potential CSV/formula injection (CWE-1236) in cell content.
    
    Protects against unsafe prefixes ('=', '+', '-', '@', '\\t', '\\r')
    including when preceded by leading whitespace, while preserving legitimate data.
    """
    if val is None:
        return ""
    if isinstance(val, (int, float, bool)):
        return val
    
    val_str = str(val)
    if val_str.startswith(UNSAFE_PREFIXES):
        return f"'{val_str}"
    
    stripped_leading = val_str.lstrip(" \t\r\n")
    if stripped_leading and stripped_leading.startswith(DANGEROUS_FORMULA_STARTS):
        return f"'{val_str}"
        
    return val_str


def generate_safe_csv(headers: Sequence[str], rows: Sequence[Sequence[Any]]) -> str:
    """Generate formula-safe CSV string.
    
    All header and row elements are sanitized against formula injection.
    """
    output = io.StringIO()
    # Add UTF-8 BOM so Excel correctly parses Gujarati Unicode characters
    output.write("\ufeff")
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")

    sanitized_headers = [sanitize_cell_value(h) for h in headers]
    writer.writerow(sanitized_headers)

    for row in rows:
        sanitized_row = [sanitize_cell_value(col) for col in row]
        writer.writerow(sanitized_row)

    return output.getvalue()

