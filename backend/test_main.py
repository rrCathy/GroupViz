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
import gap_service

client = TestClient(app)

GAP_AVAILABLE = gap_service.is_available()
needs_gap = pytest.mark.skipif(not GAP_AVAILABLE, reason="GAP backend not available")


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


def test_lattice_same_order_shares_level():
    """同阶子群必须共享同一 level（level 按阶值分层而非节点索引）——
    否则每个节点独占一层，子群格会塌成一条竖线。A5 有 10 个 2 阶子群。"""
    resp = client.post("/api/compute/lattice", json={"symbol": "A5"})
    assert resp.status_code == 200
    data = resp.json()
    nodes = data["nodes"]
    assert len(nodes) >= 10
    by_order: dict[int, set[int]] = {}
    for n in nodes:
        by_order.setdefault(n["order"], set()).add(n["level"])
    # 每个阶值至多对应一个 level（同层共享）
    for order, levels in by_order.items():
        assert len(levels) == 1, f"order {order} spans levels {levels}"
    # 确实存在同阶多子群（2 阶有 10 个），若都独占一层该断言会触发竖线
    assert len([o for o in by_order if len([n for n in nodes if n["order"] == o]) > 1]) >= 2


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


# ── GAP 集成端点（无 GAP 时自动跳过）─────────────────────────────────────────

def test_health_reports_gap():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "gap" in data
    assert data["gap"]["available"] == GAP_AVAILABLE


@needs_gap
def test_series_api():
    resp = client.post("/api/compute/series", json={
        "symbol": "S_5",
        "series_type": "composition",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "gap"
    assert len(data["terms"]) >= 2
    assert data["terms"][0]["order"] == 120
    assert data["factors"][0]["order"] == 2
    assert data["factors"][0]["is_simple"] is True


@needs_gap
def test_series_invalid_type():
    resp = client.post("/api/compute/series", json={
        "symbol": "S_5",
        "series_type": "bogus",
    })
    assert resp.status_code == 400


@needs_gap
def test_import_group_api():
    resp = client.post("/api/compute/import-group", json={
        "gap_expr": "SymmetricGroup(3)",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["order"] == 6
    assert data["structure"] == "S3"
    assert len(data["idents"]) == 6
    assert len(data["table"]) == 6
    assert len(data["gens"]) == 2


@needs_gap
def test_import_group_invalid_expr():
    resp = client.post("/api/compute/import-group", json={"gap_expr": "1 + 2"})
    assert resp.status_code == 422


@needs_gap
def test_imported_group_subgroups_use_gap():
    """导入群（PSL(2,7)→PSL(3,2)）注册后，子群计算走 GAP 全量通路。"""
    resp = client.post("/api/compute/import-group", json={
        "gap_expr": "ProjectiveSpecialLinearGroup(2,7)",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["order"] == 168
    assert data["structure"] == "PSL(3,2)"

    resp = client.post("/api/compute/subgroups", json={"symbol": "PSL(3,2)"})
    assert resp.status_code == 200
    subs = resp.json()
    assert subs["source"] == "gap"
    assert subs["total_count"] == 179
    # 元素 id 应为 g{k}（位置映射），无矩阵构造串/置换串幻影
    for sub in subs["subgroups"]:
        assert len(sub["elements"]) == sub["order"]
        for e in sub["elements"][:5]:
            assert e["id"].startswith("g")
            assert 0 <= int(e["id"][1:]) < 168


@needs_gap
def test_imported_group_info_positional_ids():
    """导入群 group-info 元素 id 为 g{k}（与前端 createGroupFromImport 对齐），
    label 为生成元单词而非 GAP 原始矩阵构造串。"""
    resp = client.post("/api/compute/import-group", json={"gap_expr": "SL(2,3)"})
    assert resp.status_code == 200

    resp = client.post("/api/group-info", json={"symbol": "SL(2,3)"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["order"] == 24
    assert [el["id"] for el in data["elements"]] == [f"g{i}" for i in range(24)]
    labels = [el["label"] for el in data["elements"]]
    assert labels[0] == "e"
    assert all("Z(3)" not in lab and not lab.startswith("NewMatrix") for lab in labels)


@needs_gap
def test_imported_q64_local_subgroups_no_phantom_ids():
    """Q64（64 阶，本地 python 通路）导入后子群端点元素 id 全为 g{k}，
    无 <identity> of ... 之类幻影串，且不能选中问题随之消失。"""
    resp = client.post("/api/compute/import-group", json={"gap_expr": "QuaternionGroup(64)"})
    assert resp.status_code == 200
    imp = resp.json()
    assert imp["structure"] == "Q64"
    assert imp["order"] == 64

    resp = client.post("/api/compute/subgroups", json={"symbol": "Q64"})
    assert resp.status_code == 200
    subs = resp.json()
    assert subs["total_count"] == 37
    seen = set()
    for sub in subs["subgroups"]:
        assert len(sub["elements"]) == sub["order"]
        for e in sub["elements"]:
            assert e["id"].startswith("g")
            idx = int(e["id"][1:])
            assert 0 <= idx < 64
            seen.add(e["id"])
    # 每个元素都出现在某子群中（含全群），去重后应为全部 64 个元素
    assert len(seen) == 64


@needs_gap
def test_small_group_structure_detection():
    """SmallGroup(16,8) 是 QD16 的半直积命名群，structure 应识别。"""
    resp = client.post("/api/compute/import-group", json={"gap_expr": "SmallGroup(16,8)"})
    assert resp.status_code == 200
    assert resp.json()["structure"] == "QD16"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
