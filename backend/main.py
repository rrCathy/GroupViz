"""
GroupViz Backend — FastAPI server for group theory computations.

Usage:
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import time
from functools import lru_cache
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from schemas import (
    GroupInfoRequest, ComputeRequest, CosetsRequest,
    CayleyEdgesRequest, ElementOrderRequest, DirectProductRequest,
)
from factory import create_group_from_symbol
from group import Group, create_direct_product
from algebra import (
    compute_subgroups, compute_normal_subgroups,
    compute_conjugacy_classes, compute_center,
    compute_cosets, compute_subgroup_lattice,
    compute_cayley_edges, compute_element_order,
    compute_group_properties,
)


# ── Caching ─────────────────────────────────────────────────────────────────

_group_cache: dict[str, Group] = {}
_subgroup_cache: dict[str, list] = {}  # symbol → low-level subgroup data


def get_group(symbol: str) -> Group:
    """Get a group by symbol, with caching."""
    if symbol not in _group_cache:
        group = create_group_from_symbol(symbol)
        if group is None:
            raise ValueError(f"Cannot create group from symbol: {symbol}")
        _group_cache[symbol] = group
    return _group_cache[symbol]


# ── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="GroupViz API",
    description="Group theory computation backend for GroupViz",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ──────────────────────────────────────────────────────────────────


@app.get("/api/health")
async def health():
    return {"status": "ok", "cached_groups": len(_group_cache)}


@app.post("/api/group-info")
async def group_info(req: GroupInfoRequest):
    """Get group structure: elements, generators, basic properties."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "symbol": g.symbol,
        "name": g.name,
        "order": g.order,
        "is_abelian": g.is_abelian,
        "exponent": g.exponent,
        "elements": [
            {"id": e.id, "label": e.label, "value": e.value}
            for e in g.elements
        ],
        "generators": [
            {"name": gen.name, "symbol": gen.symbol, "color": gen.color}
            for gen in g.generators
        ],
    }


@app.post("/api/compute/subgroups")
async def subgroups(req: ComputeRequest):
    """Find all subgroups of the group."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    result = compute_subgroups(g)
    _subgroup_cache[req.symbol] = result["subgroups"]
    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    result["elapsed_ms"] = elapsed
    return result


@app.post("/api/compute/normal-subgroups")
async def normal_subgroups(req: ComputeRequest):
    """Find all normal subgroups of the group."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    result = compute_normal_subgroups(g)
    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    result["elapsed_ms"] = elapsed
    return result


@app.post("/api/compute/conjugacy-classes")
async def conjugacy_classes(req: ComputeRequest):
    """Compute conjugacy classes of the group."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    result = compute_conjugacy_classes(g)
    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    result["elapsed_ms"] = elapsed
    return result


@app.post("/api/compute/center")
async def center(req: ComputeRequest):
    """Compute the center Z(G) of the group."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    result = compute_center(g)
    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    result["elapsed_ms"] = elapsed
    return result


@app.post("/api/compute/cosets")
async def cosets(req: CosetsRequest):
    """Compute left and right cosets for a given subgroup."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    result = compute_cosets(g, req.subgroup_element_ids)
    elapsed = round((time.perf_counter() - t0) * 1000, 1)

    if result is None:
        raise HTTPException(status_code=400, detail="Invalid subgroup: not closed or invalid IDs")

    result["elapsed_ms"] = elapsed
    return result


@app.post("/api/compute/lattice")
async def lattice(req: ComputeRequest):
    """Compute the subgroup lattice (Hasse diagram)."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    # Use cached subgroups if available to avoid recomputing
    cached_subs = _subgroup_cache.get(req.symbol)
    result = compute_subgroup_lattice(g, precomputed_subs=cached_subs)
    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    result["elapsed_ms"] = elapsed
    return result


@app.post("/api/compute/cayley-edges")
async def cayley_edges(req: CayleyEdgesRequest):
    """Compute Cayley graph edges for given action elements."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if req.multiply_type not in ("right", "left"):
        raise HTTPException(status_code=400, detail="multiply_type must be 'right' or 'left'")

    t0 = time.perf_counter()
    result = compute_cayley_edges(g, req.action_element_ids, req.multiply_type)
    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    result["elapsed_ms"] = elapsed
    return result


@app.post("/api/compute/element-order")
async def element_order(req: ElementOrderRequest):
    """Compute the order of a specific element."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    result = compute_element_order(g, req.element_id)
    elapsed = round((time.perf_counter() - t0) * 1000, 1)

    if result is None:
        raise HTTPException(status_code=400, detail=f"Element not found: {req.element_id}")

    result["elapsed_ms"] = elapsed
    return result


@app.post("/api/compute/direct-product")
async def direct_product(req: DirectProductRequest):
    """Create a direct product G × H on the server."""
    try:
        g_a = get_group(req.symbol_a)
        g_b = get_group(req.symbol_b)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    dp = create_direct_product(g_a, g_b)
    elapsed = round((time.perf_counter() - t0) * 1000, 1)

    # Cache it
    _group_cache[dp.symbol] = dp

    return {
        "symbol": dp.symbol,
        "name": dp.name,
        "order": dp.order,
        "is_abelian": dp.is_abelian,
        "exponent": dp.exponent,
        "elements": [
            {"id": e.id, "label": e.label, "value": e.value}
            for e in dp.elements
        ],
        "generators": [
            {"name": gen.name, "symbol": gen.symbol, "color": gen.color}
            for gen in dp.generators
        ],
        "elapsed_ms": elapsed,
    }


# ── Main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

@app.post("/api/compute/properties")
async def group_properties(req: ComputeRequest):
    """Solvable / nilpotent / perfect + derived series for a group."""
    try:
        g = get_group(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    t0 = time.perf_counter()
    result = compute_group_properties(g)
    result["elapsed_ms"] = round((time.perf_counter() - t0) * 1000, 1)
    return result
