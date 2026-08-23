from pydantic import BaseModel, Field
from typing import Optional, Literal

# 输入长度上限（D3 加固）：防止超长字符串/超大列表打满后端内存或 GAP 进程。
# 群阶上限 4096（与 import-group 一致）→ 元素 id 列表最长 4096 条、id 本身 ≤64 字符。
MAX_SYMBOL_LEN = 200
MAX_ELEMENT_ID_LEN = 64
MAX_ELEMENT_LIST_LEN = 4096
MAX_GAP_EXPR_LEN = 2000


class GroupInfoRequest(BaseModel):
    symbol: str = Field(max_length=MAX_SYMBOL_LEN)


class ComputeRequest(BaseModel):
    symbol: str = Field(max_length=MAX_SYMBOL_LEN)


class CosetsRequest(BaseModel):
    symbol: str = Field(max_length=MAX_SYMBOL_LEN)
    subgroup_element_ids: list[str] = Field(
        max_length=MAX_ELEMENT_LIST_LEN,
        min_length=1,
    )


class CayleyEdgesRequest(BaseModel):
    symbol: str = Field(max_length=MAX_SYMBOL_LEN)
    action_element_ids: list[str] = Field(
        max_length=MAX_ELEMENT_LIST_LEN,
        min_length=1,
    )
    multiply_type: Literal["right", "left"] = "right"


class ElementOrderRequest(BaseModel):
    symbol: str = Field(max_length=MAX_SYMBOL_LEN)
    element_id: str = Field(max_length=MAX_ELEMENT_ID_LEN)


class DirectProductRequest(BaseModel):
    symbol_a: str = Field(max_length=MAX_SYMBOL_LEN)
    symbol_b: str = Field(max_length=MAX_SYMBOL_LEN)


class SeriesRequest(BaseModel):
    symbol: str = Field(max_length=MAX_SYMBOL_LEN)
    series_type: Literal["derived", "upperCentral", "lowerCentral", "composition"]


class ImportGroupRequest(BaseModel):
    gap_expr: str = Field(min_length=1, max_length=MAX_GAP_EXPR_LEN)


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
