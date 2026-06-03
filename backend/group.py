"""
Group theory core: GroupElement, Generator, Group dataclass, and all group construction functions.

Every Group stores a precomputed Cayley table (_table[i][j] = index of elements[i] * elements[j])
and inverse map (_inverse_map[i] = index of elements[i]^{-1}) for O(1) operations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional
import math


# ── Element & Generator ──────────────────────────────────────────────────────

@dataclass
class GroupElement:
    id: str
    label: str
    value: list[int]


@dataclass
class Generator:
    name: str
    symbol: str
    color: str


# ── Group ────────────────────────────────────────────────────────────────────

@dataclass
class Group:
    name: str
    symbol: str
    order: int
    elements: list[GroupElement]
    generators: list[Generator]
    identity_idx: int
    is_abelian: bool

    # Computed (set by _build_group)
    _table: list[list[int]] = field(repr=False)
    _inverse_map: list[int] = field(repr=False)
    _id_to_idx: dict[str, int] = field(repr=False)

    exponent: Optional[int] = None

    def multiply_idx(self, i: int, j: int) -> int:
        return self._table[i][j]

    def multiply(self, a: GroupElement, b: GroupElement) -> GroupElement:
        return self.elements[self._table[self._id_to_idx[a.id]][self._id_to_idx[b.id]]]

    def inverse(self, el: GroupElement) -> GroupElement:
        return self.elements[self._inverse_map[self._id_to_idx[el.id]]]

    def inverse_idx(self, i: int) -> int:
        return self._inverse_map[i]

    def idx(self, el: GroupElement) -> int:
        return self._id_to_idx[el.id]

    def element_by_id(self, element_id: str) -> Optional[GroupElement]:
        idx = self._id_to_idx.get(element_id)
        return self.elements[idx] if idx is not None else None


def _build_group(
    name: str,
    symbol: str,
    elements: list[GroupElement],
    generators: list[Generator],
    multiply_fn: Callable[[GroupElement, GroupElement], GroupElement],
    inverse_fn: Callable[[GroupElement], GroupElement],
    identity: GroupElement,
    is_abelian: bool,
    exponent: Optional[int] = None,
) -> Group:
    """Helper: builds the precomputed Cayley table and returns a Group."""
    n = len(elements)
    id_to_idx = {e.id: i for i, e in enumerate(elements)}

    # Precompute Cayley table
    table = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            prod = multiply_fn(elements[i], elements[j])
            table[i][j] = id_to_idx[prod.id]

    # Precompute inverse map
    inv_map = [0] * n
    for i in range(n):
        inv_map[i] = id_to_idx[inverse_fn(elements[i]).id]

    identity_idx = id_to_idx[identity.id]

    return Group(
        name=name,
        symbol=symbol,
        order=n,
        elements=elements,
        generators=generators,
        identity_idx=identity_idx,
        is_abelian=is_abelian,
        exponent=exponent,
        _table=table,
        _inverse_map=inv_map,
        _id_to_idx=id_to_idx,
    )


# ── Permutation Helpers ─────────────────────────────────────────────────────

def _perm_to_cycles(arr: list[int]) -> list[list[int]]:
    """Decompose permutation arr (1-indexed values) into disjoint cycles."""
    n = len(arr)
    visited = [False] * n
    cycles: list[list[int]] = []
    for i in range(n):
        if visited[i]:
            continue
        cycle: list[int] = []
        cur = i
        while not visited[cur]:
            visited[cur] = True
            cycle.append(cur + 1)
            cur = arr[cur] - 1
        if len(cycle) > 1:
            cycles.append(cycle)
    return cycles


def _perm_to_string(arr: list[int]) -> str:
    """Convert permutation to cycle-notation string (like TypeScript permToString)."""
    cycles = _perm_to_cycles(arr)
    if not cycles:
        return "e"
    parts = [f"({' '.join(map(str, c))})" if len(c) > 2 else f"({c[0]}{c[1]})" for c in cycles]
    return "".join(parts)


def _permutation_parity(arr: list[int]) -> int:
    """Return parity: 0=even, 1=odd."""
    n = len(arr)
    visited = [False] * n
    parity = 0
    for i in range(n):
        if visited[i]:
            continue
        length = 0
        cur = i
        while not visited[cur]:
            visited[cur] = True
            length += 1
            cur = arr[cur] - 1
        if length > 1:
            parity += length - 1
    return parity & 1


# ── Cyclic Group C_n ─────────────────────────────────────────────────────────

def create_cyclic(n: int) -> Group:
    assert n >= 1
    elements = [GroupElement(id=f"e{i}", label=str(i), value=[i]) for i in range(n)]

    def multiply(a: GroupElement, b: GroupElement) -> GroupElement:
        return elements[(a.value[0] + b.value[0]) % n]

    def inverse(a: GroupElement) -> GroupElement:
        return elements[(-a.value[0]) % n]

    gen = Generator(name="a", symbol="a", color="#ff6b6b")
    return _build_group(
        name=f"Cyclic Group C_{{{n}}}",
        symbol=f"C_{{{n}}}",
        elements=elements,
        generators=[gen],
        multiply_fn=multiply,
        inverse_fn=inverse,
        identity=elements[0],
        is_abelian=True,
        exponent=n,
    )


# ── Symmetric Group S_n ─────────────────────────────────────────────────────

def _generate_permutations(n: int) -> list[list[int]]:
    """Generate all n! permutations of [1..n] via backtracking."""
    result: list[list[int]] = []
    used = [False] * n
    current = [0] * n

    def backtrack(depth: int):
        if depth == n:
            result.append(current[:])
            return
        for i in range(n):
            if not used[i]:
                used[i] = True
                current[depth] = i + 1
                backtrack(depth + 1)
                used[i] = False

    backtrack(0)
    return result


def create_symmetric(n: int) -> Group:
    assert n >= 2
    perms = _generate_permutations(n)
    elements = [
        GroupElement(id=",".join(map(str, p)), label=_perm_to_string(p), value=p)
        for p in perms
    ]

    def multiply(a: GroupElement, b: GroupElement) -> GroupElement:
        result = [b.value[a.value[i] - 1] for i in range(n)]
        return next(e for e in elements if e.value == result)

    def inverse(a: GroupElement) -> GroupElement:
        inv = [0] * n
        for i, v in enumerate(a.value):
            inv[v - 1] = i + 1
        return next(e for e in elements if e.value == inv)

    gen_a = Generator(name="s12", symbol="\\sigma_{12}", color="#ff6b6b")
    gens = [gen_a]
    if n >= 3:
        gens.append(Generator(name="s23", symbol="\\sigma_{23}", color="#4ecdc4"))
    if n >= 4:
        gens.append(Generator(name="s34", symbol="\\sigma_{34}", color="#ffd93d"))

    identity = elements[0]
    return _build_group(
        name=f"Symmetric Group S_{{{n}}}",
        symbol=f"S_{{{n}}}",
        elements=elements,
        generators=gens,
        multiply_fn=multiply,
        inverse_fn=inverse,
        identity=identity,
        is_abelian=(n <= 2),
    )


def create_s3() -> Group:
    return create_symmetric(3)


# ── Dihedral Group D_n ──────────────────────────────────────────────────────

def create_dihedral(n: int) -> Group:
    assert n >= 3
    order = 2 * n

    elements: list[GroupElement] = []
    for k in range(n):
        elements.append(GroupElement(id=f"r{k}", label=f"r^{{{k}}}" if k else "e", value=[k, 0]))
    for k in range(n):
        elements.append(GroupElement(id=f"s{k}", label=f"s_{{{k}}}", value=[k, 1]))

    def multiply(a: GroupElement, b: GroupElement) -> GroupElement:
        ra, sa = a.value
        rb, sb = b.value
        # D_n rule table:
        # rotation * rotation = rotation: (ra+rb) mod n
        # rotation * reflection = reflection: (ra+rb) mod n
        # reflection * rotation = reflection: (ra-rb) mod n
        # reflection * reflection = rotation: (ra-rb) mod n
        if sa == 0 and sb == 0:
            return elements[(ra + rb) % n]
        elif sa == 0 and sb == 1:
            return elements[n + (ra + rb) % n]
        elif sa == 1 and sb == 0:
            return elements[n + (ra - rb) % n]
        else:  # sa == 1, sb == 1
            return elements[(ra - rb) % n]

    def inverse(a: GroupElement) -> GroupElement:
        r, s = a.value
        if s == 0:
            return elements[(-r) % n]
        else:
            return a  # reflections are self-inverse

    gen_r = Generator(name="r", symbol="r", color="#ff6b6b")
    gen_s = Generator(name="s", symbol="s", color="#4ecdc4")
    return _build_group(
        name=f"Dihedral Group D_{{{n}}}",
        symbol=f"D_{{{n}}}",
        elements=elements,
        generators=[gen_r, gen_s],
        multiply_fn=multiply,
        inverse_fn=inverse,
        identity=elements[0],
        is_abelian=False,
        exponent=n if n % 2 == 0 else 2 * n,
    )


# ── Alternating Group A_n ───────────────────────────────────────────────────

def create_alternating(n: int) -> Group:
    assert 3 <= n <= 6
    all_perms = _generate_permutations(n)
    even_perms = [p for p in all_perms if _permutation_parity(p) == 0]

    elements = [
        GroupElement(id=",".join(map(str, p)), label=_perm_to_string(p), value=p)
        for p in even_perms
    ]

    def multiply(a: GroupElement, b: GroupElement) -> GroupElement:
        result = [b.value[a.value[i] - 1] for i in range(n)]
        return next(e for e in elements if e.value == result)

    def inverse(a: GroupElement) -> GroupElement:
        inv = [0] * n
        for i, v in enumerate(a.value):
            inv[v - 1] = i + 1
        return next(e for e in elements if e.value == inv)

    # Generators vary by n
    if n == 3:
        gens = [Generator(name="a", symbol="(123)", color="#ff6b6b")]
    elif n == 4:
        gens = [
            Generator(name="a", symbol="(12)(34)", color="#ff6b6b"),
            Generator(name="b", symbol="(234)", color="#4ecdc4"),
        ]
    else:
        gens = [
            Generator(name="a", symbol="(12)(34)", color="#ff6b6b"),
            Generator(name="b", symbol="(135)", color="#4ecdc4"),
        ]

    return _build_group(
        name=f"Alternating Group A_{{{n}}}",
        symbol=f"A_{{{n}}}",
        elements=elements,
        generators=gens,
        multiply_fn=multiply,
        inverse_fn=inverse,
        identity=elements[0],
        is_abelian=(n <= 3),
    )


# ── Special Groups ──────────────────────────────────────────────────────────

def create_klein_four() -> Group:
    """V_4 = Klein four-group."""
    elements = [
        GroupElement(id="e", label="e", value=[0]),
        GroupElement(id="a", label="a", value=[1]),
        GroupElement(id="b", label="b", value=[2]),
        GroupElement(id="c", label="c", value=[3]),
    ]
    table = [
        [0, 1, 2, 3],
        [1, 0, 3, 2],
        [2, 3, 0, 1],
        [3, 2, 1, 0],
    ]

    def multiply_idx(a: GroupElement, b: GroupElement) -> GroupElement:
        return elements[table[a.value[0]][b.value[0]]]

    gens = [
        Generator(name="a", symbol="a", color="#ff6b6b"),
        Generator(name="b", symbol="b", color="#4ecdc4"),
    ]
    return _build_group(
        name="Klein Four-Group V_{4}",
        symbol="V_{4}",
        elements=elements,
        generators=gens,
        multiply_fn=multiply_idx,
        inverse_fn=lambda a: a,  # every element is self-inverse
        identity=elements[0],
        is_abelian=True,
        exponent=2,
    )


def create_quaternion() -> Group:
    """Q_8 = Quaternion group."""
    labels = ["1", "-1", "i", "-i", "j", "-j", "k", "-k"]
    ids = ["1", "m1", "i", "mi", "j", "mj", "k", "mk"]
    elements = [
        GroupElement(id=ids[i], label=labels[i], value=[i]) for i in range(8)
    ]
    # Quaternion multiplication table (indices)
    qt: list[list[int]] = [
        [0, 1, 2, 3, 4, 5, 6, 7],
        [1, 0, 3, 2, 5, 4, 7, 6],
        [2, 3, 1, 0, 6, 7, 5, 4],
        [3, 2, 0, 1, 7, 6, 4, 5],
        [4, 5, 7, 6, 1, 0, 2, 3],
        [5, 4, 6, 7, 0, 1, 3, 2],
        [6, 7, 4, 5, 3, 2, 1, 0],
        [7, 6, 5, 4, 2, 3, 0, 1],
    ]
    inv_map = [0, 1, 3, 2, 5, 4, 7, 6]

    gens = [
        Generator(name="i", symbol="i", color="#ff6b6b"),
        Generator(name="j", symbol="j", color="#4ecdc4"),
    ]
    return _build_group(
        name="Quaternion Group Q_{8}",
        symbol="Q_{8}",
        elements=elements,
        generators=gens,
        multiply_fn=lambda a, b: elements[qt[a.value[0]][b.value[0]]],
        inverse_fn=lambda a: elements[inv_map[a.value[0]]],
        identity=elements[0],
        is_abelian=False,
        exponent=4,
    )


# ── Direct Product Groups (hardcoded) ───────────────────────────────────────

def create_z4xz2() -> Group:
    """Z_4 × Z_2, order 8."""
    elements: list[GroupElement] = []
    for a in range(4):
        for b in range(2):
            elements.append(GroupElement(
                id=f"e{a}_{b}",
                label=f"({a},{b})",
                value=[a, b],
            ))

    def multiply(x: GroupElement, y: GroupElement) -> GroupElement:
        a = (x.value[0] + y.value[0]) % 4
        b = (x.value[1] + y.value[1]) % 2
        return elements[a * 2 + b]

    def inverse(x: GroupElement) -> GroupElement:
        a = (-x.value[0]) % 4
        b = (-x.value[1]) % 2
        return elements[a * 2 + b]

    gens = [
        Generator(name="a", symbol="a", color="#ff6b6b"),
        Generator(name="b", symbol="b", color="#4ecdc4"),
    ]
    return _build_group(
        name="Z_{4} \\times Z_{2}",
        symbol="Z_{4}\\times Z_{2}",
        elements=elements,
        generators=gens,
        multiply_fn=multiply,
        inverse_fn=inverse,
        identity=elements[0],
        is_abelian=True,
        exponent=4,
    )


def create_z2x_z2x_z2() -> Group:
    """Z_2^3, order 8."""
    elements: list[GroupElement] = []
    for a in range(2):
        for b in range(2):
            for c in range(2):
                elements.append(GroupElement(
                    id=f"e{a}_{b}_{c}",
                    label=f"({a},{b},{c})",
                    value=[a, b, c],
                ))

    def multiply(x: GroupElement, y: GroupElement) -> GroupElement:
        a = x.value[0] ^ y.value[0]
        b = x.value[1] ^ y.value[1]
        c = x.value[2] ^ y.value[2]
        return elements[a * 4 + b * 2 + c]

    gens = [
        Generator(name="a", symbol="a", color="#ff6b6b"),
        Generator(name="b", symbol="b", color="#4ecdc4"),
        Generator(name="c", symbol="c", color="#ffd93d"),
    ]
    return _build_group(
        name="Z_{2}^{3}",
        symbol="Z_{2}^{3}",
        elements=elements,
        generators=gens,
        multiply_fn=multiply,
        inverse_fn=lambda a: a,
        identity=elements[0],
        is_abelian=True,
        exponent=2,
    )


def create_z3xz3() -> Group:
    """Z_3 × Z_3, order 9."""
    elements: list[GroupElement] = []
    for a in range(3):
        for b in range(3):
            elements.append(GroupElement(
                id=f"e{a}_{b}",
                label=f"({a},{b})",
                value=[a, b],
            ))

    def multiply(x: GroupElement, y: GroupElement) -> GroupElement:
        a = (x.value[0] + y.value[0]) % 3
        b = (x.value[1] + y.value[1]) % 3
        return elements[a * 3 + b]

    def inverse(x: GroupElement) -> GroupElement:
        a = (-x.value[0]) % 3
        b = (-x.value[1]) % 3
        return elements[a * 3 + b]

    gens = [
        Generator(name="a", symbol="a", color="#ff6b6b"),
        Generator(name="b", symbol="b", color="#4ecdc4"),
    ]
    return _build_group(
        name="Z_{3} \\times Z_{3}",
        symbol="Z_{3}\\times Z_{3}",
        elements=elements,
        generators=gens,
        multiply_fn=multiply,
        inverse_fn=inverse,
        identity=elements[0],
        is_abelian=True,
        exponent=3,
    )


def create_z6xz2() -> Group:
    """Z_6 × Z_2, order 12."""
    elements: list[GroupElement] = []
    for a in range(6):
        for b in range(2):
            elements.append(GroupElement(
                id=f"e{a}_{b}",
                label=f"({a},{b})",
                value=[a, b],
            ))

    def multiply(x: GroupElement, y: GroupElement) -> GroupElement:
        a = (x.value[0] + y.value[0]) % 6
        b = (x.value[1] + y.value[1]) % 2
        return elements[a * 2 + b]

    def inverse(x: GroupElement) -> GroupElement:
        a = (-x.value[0]) % 6
        b = (-x.value[1]) % 2
        return elements[a * 2 + b]

    gens = [
        Generator(name="a", symbol="a", color="#ff6b6b"),
        Generator(name="b", symbol="b", color="#4ecdc4"),
    ]
    return _build_group(
        name="Z_{6} \\times Z_{2}",
        symbol="Z_{6}\\times Z_{2}",
        elements=elements,
        generators=gens,
        multiply_fn=multiply,
        inverse_fn=inverse,
        identity=elements[0],
        is_abelian=True,
        exponent=6,
    )


# ── Dynamic Direct Product ─────────────────────────────────────────────────

def create_direct_product(group_a: Group, group_b: Group) -> Group:
    """Create G × H for any two Groups."""
    n_a = group_a.order
    n_b = group_b.order

    elements: list[GroupElement] = []
    for a in group_a.elements:
        for b in group_b.elements:
            elements.append(GroupElement(
                id=f"{a.id}|{b.id}",
                label=f"({a.label}, {b.label})",
                value=a.value + b.value,
            ))

    # Pre-build lookup maps
    id_to_idx_a = {e.id: i for i, e in enumerate(group_a.elements)}
    id_to_idx_b = {e.id: i for i, e in enumerate(group_b.elements)}

    def multiply(x: GroupElement, y: GroupElement) -> GroupElement:
        a_id, b_id = x.id.split("|", 1)
        c_id, d_id = y.id.split("|", 1)
        ia = id_to_idx_a[a_id]
        ib = id_to_idx_b[b_id]
        ic = id_to_idx_a[c_id]
        iid = id_to_idx_b[d_id]
        prod_a = group_a._table[ia][ic]
        prod_b = group_b._table[ib][iid]
        a_el = group_a.elements[prod_a]
        b_el = group_b.elements[prod_b]
        return elements[prod_a * n_b + prod_b]

    def inverse(x: GroupElement) -> GroupElement:
        a_id, b_id = x.id.split("|", 1)
        ia = id_to_idx_a[a_id]
        ib = id_to_idx_b[b_id]
        inv_a = group_a._inverse_map[ia]
        inv_b = group_b._inverse_map[ib]
        return elements[inv_a * n_b + inv_b]

    # Build generators
    color_palette = ["#ff6b6b", "#4ecdc4", "#ffd93d", "#a78bfa", "#f97316", "#06b6d4"]
    gens: list[Generator] = []
    for i, g in enumerate(group_a.generators):
        gens.append(Generator(
            name=f"{g.name}_A",
            symbol=g.symbol,
            color=color_palette[i % len(color_palette)],
        ))
    offset = len(group_a.generators)
    for i, g in enumerate(group_b.generators):
        gens.append(Generator(
            name=f"{g.name}_B",
            symbol=g.symbol,
            color=color_palette[(offset + i) % len(color_palette)],
        ))

    # Build symbol
    sym_a = group_a.symbol.replace("_{", "_{").replace("^{", "^{") if group_a.symbol else "G"
    sym_b = group_b.symbol.replace("_{", "_{").replace("^{", "^{") if group_b.symbol else "H"
    product_symbol = f"{group_a.symbol}\\times {group_b.symbol}"

    # Exponent = lcm of exponents
    exp = None
    if group_a.exponent is not None and group_b.exponent is not None:
        exp = (group_a.exponent * group_b.exponent) // math.gcd(group_a.exponent, group_b.exponent)

    is_ab = group_a.is_abelian and group_b.is_abelian

    return _build_group(
        name=f"{group_a.name} \\times {group_b.name}",
        symbol=product_symbol,
        elements=elements,
        generators=gens,
        multiply_fn=multiply,
        inverse_fn=inverse,
        identity=elements[0],
        is_abelian=is_ab,
        exponent=exp,
    )
