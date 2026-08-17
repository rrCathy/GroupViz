from pydantic import BaseModel
from typing import Optional


class GroupInfoRequest(BaseModel):
    symbol: str


class ComputeRequest(BaseModel):
    symbol: str


class CosetsRequest(BaseModel):
    symbol: str
    subgroup_element_ids: list[str]


class CayleyEdgesRequest(BaseModel):
    symbol: str
    action_element_ids: list[str]
    multiply_type: str = "right"  # "right" or "left"


class ElementOrderRequest(BaseModel):
    symbol: str
    element_id: str


class DirectProductRequest(BaseModel):
    symbol_a: str
    symbol_b: str


class SeriesRequest(BaseModel):
    symbol: str
    series_type: str  # derived / upperCentral / lowerCentral / composition


class ImportGroupRequest(BaseModel):
    gap_expr: str


# ---- Response models (documentation only, actual responses are JSON) ----

class ElementResponse(BaseModel):
    id: str
    label: str
    value: list[int]


class GeneratorResponse(BaseModel):
    name: str
    symbol: str
    color: str


class GroupInfoResponse(BaseModel):
    symbol: str
    name: str
    order: int
    is_abelian: bool
    exponent: Optional[int] = None
    elements: list[ElementResponse]
    generators: list[GeneratorResponse]


class SubgroupResponse(BaseModel):
    elements: list[ElementResponse]
    is_normal: bool
    order: int


class SubgroupListResponse(BaseModel):
    subgroups: list[SubgroupResponse]
    total_count: int


class NormalSubgroupListResponse(BaseModel):
    normal_subgroups: list[SubgroupResponse]
    total_count: int


class ConjugacyClassResponse(BaseModel):
    classes: list[list[ElementResponse]]


class CenterResponse(BaseModel):
    center: list[ElementResponse]


class CosetResponse(BaseModel):
    left_cosets: list[list[ElementResponse]]
    right_cosets: list[list[ElementResponse]]
    is_normal: bool
    num_cosets: int


class LatticeNode(BaseModel):
    id: int
    elements: list[ElementResponse]
    order: int
    is_normal: bool
    level: int


class LatticeEdge(BaseModel):
    source: int
    target: int


class LatticeResponse(BaseModel):
    nodes: list[LatticeNode]
    edges: list[LatticeEdge]


class CayleyEdgeResponse(BaseModel):
    from_idx: int
    to_idx: int
    from_id: str
    to_id: str
    action_element_id: str
    color: str
    is_bidirectional: bool
    is_self_loop: bool


class CayleyEdgesResponse(BaseModel):
    edges: list[CayleyEdgeResponse]


class ElementOrderResponse(BaseModel):
    element_id: str
    element_label: str
    order: int
    cycle: list[ElementResponse]
