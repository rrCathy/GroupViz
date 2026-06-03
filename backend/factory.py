"""
Group factory: recreates a Group from its TeX/Unicode symbol string.
Supports recursive direct products and exponent notation.
"""

from __future__ import annotations

import re
from typing import Optional
from group import (
    Group, create_cyclic, create_symmetric, create_dihedral, create_alternating,
    create_klein_four, create_quaternion, create_z4xz2, create_z2x_z2x_z2,
    create_z3xz3, create_z6xz2, create_direct_product,
)


def _strip_braces(s: str) -> str:
    """Remove LaTeX braces {} from a string."""
    return s.replace("{", "").replace("}", "")


def _extract_number(symbol: str, prefix: str) -> Optional[int]:
    """Extract number from symbol like 'S_{3}' or 'C_5' or 'S3'."""
    # TeX subscript with braces: S_{3}
    m = re.match(rf"^{re.escape(prefix)}_\{{(\d+)\}}$", symbol)
    if m:
        return int(m.group(1))
    # Plain subscript without braces: C_5
    m = re.match(rf"^{re.escape(prefix)}_(\d+)$", symbol)
    if m:
        return int(m.group(1))
    # No subscript: S3
    m = re.match(rf"^{re.escape(prefix)}(\d+)$", symbol)
    if m:
        return int(m.group(1))
    return None


def _parse_superscript(symbol: str) -> tuple[str, int] | None:
    """Parse symbol like 'C_{3}^{2}' -> ('C_{3}', 2) or 'C_3^2' -> ('C_3', 2)."""
    m = re.match(r"^(.+?)\^{(\d+)}$", symbol)
    if m:
        return m.group(1), int(m.group(2))
    m = re.match(r"^(.+?)\^(\d+)$", symbol)
    if m:
        return m.group(1), int(m.group(2))
    return None


def create_group_from_symbol(symbol: str) -> Optional[Group]:
    """
    Create a Group from a symbol string.
    Supports: C_n, Z_n, S_n, D_n, A_n, V_4, Q_8,
    Z_4×Z_2, Z_2³, Z_3×Z_3, Z_6×Z_2,
    and recursive direct products: G \\times H, G^{n}.
    """
    if not symbol:
        return None

    # Normalize: replace Unicode × with TeX \times, clean up spaces
    s = symbol.strip().replace("×", "\\times")
    # In regex replacement, \\\\times = literal \\times (\\\\ → \ in replacement)
    s = re.sub(r"\s*\\times\s*", "\\\\times", s)

    # Strip braces for matching (keeps TeX subscripts readable)
    s_nobraces = _strip_braces(s)

    # Exact matches
    exact_map: dict[str, callable] = {
        "V_4": create_klein_four,
        "Q_8": create_quaternion,
        "Z_4\\times Z_2": create_z4xz2,
        "Z_2^3": create_z2x_z2x_z2,
        "Z_2\\times Z_2\\times Z_2": create_z2x_z2x_z2,
        "Z_3\\times Z_3": create_z3xz3,
        "Z_6\\times Z_2": create_z6xz2,
        "C_2^3": create_z2x_z2x_z2,
        "C_3^2": lambda: create_direct_product(create_cyclic(3), create_cyclic(3)),
    }

    if s_nobraces in exact_map:
        return exact_map[s_nobraces]()

    # ── Superscript power ──
    sup = _parse_superscript(s)
    if sup is None:
        sup = _parse_superscript(s_nobraces)

    if sup:
        base, exp = sup
        base_group = create_group_from_symbol(base)
        if base_group is None:
            return None
        result = base_group
        for _ in range(exp - 1):
            result = create_direct_product(result, base_group)
        return result

    # ── Direct product: G \\times H ──
    if "\\times" in s_nobraces:
        # Split on the first \\times, handling balanced braces
        left_s, right_s = _split_direct_product(s_nobraces)
        if left_s and right_s:
            left = create_group_from_symbol(left_s.strip())
            right = create_group_from_symbol(right_s.strip())
            if left and right:
                return create_direct_product(left, right)
        return None

    # ── Cyclic groups: C_n or Z_n ──
    for prefix in ["C", "Z"]:
        n = _extract_number(s, prefix) or _extract_number(s_nobraces, prefix)
        if n is not None and 1 <= n <= 120:
            return create_cyclic(n)

    # ── Dihedral groups: D_n ──
    n = _extract_number(s, "D") or _extract_number(s_nobraces, "D")
    if n is not None and 3 <= n <= 20:
        return create_dihedral(n)

    # ── Symmetric groups: S_n ──
    n = _extract_number(s, "S") or _extract_number(s_nobraces, "S")
    if n is not None and 2 <= n <= 6:
        return create_symmetric(n)

    # ── Alternating groups: A_n ──
    n = _extract_number(s, "A") or _extract_number(s_nobraces, "A")
    if n is not None and 3 <= n <= 6:
        return create_alternating(n)

    return None


def _split_direct_product(s: str) -> tuple[str, str] | None:
    """Split a direct product string like 'C_2\\times C_3' into ('C_2', 'C_3').
    Handles TeX grouping: 'C_{2}\\times D_{4}' -> ('C_{2}', 'D_{4}')."""
    idx = s.find("\\times")
    if idx < 0:
        return None
    return s[:idx], s[idx + len("\\times"):]
