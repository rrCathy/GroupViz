"""
Tests for the GroupViz backend.

Usage:
    cd backend
    pip install pytest httpx
    pytest test_main.py -v
"""

import pytest
from factory import create_group_from_symbol
from group import create_cyclic, create_symmetric, create_dihedral, create_klein_four, create_quaternion
from algebra import (
    compute_subgroups, compute_normal_subgroups, compute_conjugacy_classes,
    compute_center, compute_cosets, compute_subgroup_lattice,
    compute_cayley_edges, compute_element_order,
)


# ── Group Creation ──────────────────────────────────────────────────────────

def test_create_cyclic():
    c4 = create_cyclic(4)
    assert c4.order == 4
    assert c4.is_abelian
    assert c4.exponent == 4
    assert len(c4.elements) == 4
    assert len(c4.generators) == 1

    # Multiply: 1 + 2 = 3
    prod = c4.multiply(c4.elements[1], c4.elements[2])
    assert prod.value == [3]

    # Inverse of 1 is 3
    inv = c4.inverse(c4.elements[1])
    assert inv.value == [3]


def test_create_symmetric():
    s3 = create_symmetric(3)
    assert s3.order == 6
    assert not s3.is_abelian
    assert len(s3.generators) >= 2


def test_create_dihedral():
    d4 = create_dihedral(4)
    assert d4.order == 8
    assert not d4.is_abelian
    assert d4.exponent == 4  # even n


def test_create_klein_four():
    v4 = create_klein_four()
    assert v4.order == 4
    assert v4.is_abelian
    assert v4.exponent == 2

    # Every element should be self-inverse
    for e in v4.elements:
        assert v4.inverse(e).id == e.id


def test_create_quaternion():
    q8 = create_quaternion()
    assert q8.order == 8
    assert not q8.is_abelian

    # i * i = -1
    i_el = q8.elements[2]  # "i"
    prod = q8.multiply(i_el, i_el)
    assert prod.id == "m1"  # "-1"


def test_factory_from_symbol():
    c5 = create_group_from_symbol("C_5")
    assert c5 is not None
    assert c5.order == 5

    s3 = create_group_from_symbol("S_3")
    assert s3 is not None
    assert s3.order == 6

    d5 = create_group_from_symbol("D_5")
    assert d5 is not None
    assert d5.order == 10

    a4 = create_group_from_symbol("A_4")
    assert a4 is not None
    assert a4.order == 12

    v4 = create_group_from_symbol("V_4")
    assert v4 is not None
    assert v4.order == 4

    q8 = create_group_from_symbol("Q_8")
    assert q8 is not None
    assert q8.order == 8


# ── Algebraic Computations ─────────────────────────────────────────────────

def test_element_order():
    c6 = create_cyclic(6)
    result = compute_element_order(c6, "e2")  # element with value [2]
    assert result is not None
    assert result["order"] == 3  # order of 2 in Z_6 is 3


def test_subgroups_s3():
    s3 = create_symmetric(3)
    result = compute_subgroups(s3)
    # S_3 has 6 subgroups: {e}, 3×C2, A3=Z3, S3
    assert result["total_count"] >= 4


def test_normal_subgroups_s3():
    s3 = create_symmetric(3)
    result = compute_normal_subgroups(s3)
    # Normal: {e}, A3, S3
    assert result["total_count"] == 3


def test_conjugacy_classes_s3():
    s3 = create_symmetric(3)
    result = compute_conjugacy_classes(s3)
    # 3 classes: identity, transpositions (3), 3-cycles (2)
    assert len(result["classes"]) == 3


def test_center_s3():
    s3 = create_symmetric(3)
    result = compute_center(s3)
    # Z(S3) = {e}
    assert len(result["center"]) == 1


def test_cosets():
    s3 = create_symmetric(3)
    # Subgroup: {e, (12)} — element IDs "1,2,3" and "2,1,3"
    result = compute_cosets(s3, ["1,2,3", "2,1,3"])
    assert result is not None
    assert result["num_cosets"] == 3  # |S3|/2 = 3
    assert result["is_normal"] == False


def test_subgroup_lattice():
    s3 = create_symmetric(3)
    result = compute_subgroup_lattice(s3)
    assert len(result["nodes"]) >= 4
    assert len(result["edges"]) >= 3


def test_cayley_edges_right():
    s3 = create_symmetric(3)
    # Generate edges with the generator (12): id "2,1,3"
    result = compute_cayley_edges(s3, ["2,1,3"], "right")
    assert len(result["edges"]) > 0


def test_cayley_edges_left():
    s3 = create_symmetric(3)
    result = compute_cayley_edges(s3, ["2,1,3"], "left")
    assert len(result["edges"]) > 0


def test_direct_product_caching():
    """Test that the factory can handle direct products."""
    dp = create_group_from_symbol(r"C_2\times C_3")
    assert dp is not None
    assert dp.order == 6
    assert dp.is_abelian

    dp2 = create_group_from_symbol(r"C_{2}\times C_{2}")
    assert dp2 is not None
    assert dp2.order == 4  # V4


# ── API Integration Tests ──────────────────────────────────────────────────

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_group_info_api():
    resp = client.post("/api/group-info", json={"symbol": "S_3"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["order"] == 6
    assert not data["is_abelian"]


def test_subgroups_api():
    resp = client.post("/api/compute/subgroups", json={"symbol": "S_3"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_count"] >= 4


def test_conjugacy_classes_api():
    resp = client.post("/api/compute/conjugacy-classes", json={"symbol": "S_3"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["classes"]) == 3


def test_center_api():
    resp = client.post("/api/compute/center", json={"symbol": "S_3"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["center"]) == 1


def test_cosets_api():
    resp = client.post("/api/compute/cosets", json={
        "symbol": "S_3",
        "subgroup_element_ids": ["1,2,3", "2,1,3"]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["num_cosets"] == 3


def test_lattice_api():
    resp = client.post("/api/compute/lattice", json={"symbol": "S_3"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["nodes"]) >= 4


def test_cayley_edges_api():
    resp = client.post("/api/compute/cayley-edges", json={
        "symbol": "S_3",
        "action_element_ids": ["2,1,3"],
        "multiply_type": "right"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["edges"]) > 0


def test_element_order_api():
    resp = client.post("/api/compute/element-order", json={
        "symbol": "S_3",
        "element_id": "2,3,1"  # (123) has order 3
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["order"] == 3


def test_direct_product_api():
    resp = client.post("/api/compute/direct-product", json={
        "symbol_a": "C_2",
        "symbol_b": "C_3"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["order"] == 6


def test_invalid_symbol():
    resp = client.post("/api/group-info", json={"symbol": "X_999"})
    assert resp.status_code == 400


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
