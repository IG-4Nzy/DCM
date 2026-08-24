from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response
from auth_utils import require_privilege, require_any_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db
from bson import ObjectId
from datetime import datetime, timezone
from pydantic import BaseModel, Field, ConfigDict, field_validator

router = APIRouter()
collection = db.get_collection("gpus")


class GPUModel(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    gpuName: str
    remarks: Optional[str] = None
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedBy: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class CreateGPUModel(BaseModel):
    gpuName: str
    remarks: Optional[str] = None

    @field_validator('gpuName')
    @classmethod
    def validate_gpu_name(cls, v):
        import re
        if v:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("GPU Name cannot be empty")
            if not re.match(r"^[a-zA-Z0-9\s/+-]+$", v_trimmed):
                raise ValueError("GPU Name must contain alphanumeric characters, spaces, slashes, pluses or dashes only")
            if len(v_trimmed) > 50:
                raise ValueError("GPU Name must be maximum 50 characters")
            return v_trimmed
        return v

    @field_validator('remarks')
    @classmethod
    def validate_remarks(cls, v):
        import re
        if v is not None:
            v_trimmed = v.strip()
            if v_trimmed:
                if not re.match(r"^[a-zA-Z0-9\s,.:-]+$", v_trimmed):
                    raise ValueError("Remarks must contain alphanumeric characters, spaces, commas, periods, colons, or dashes only")
                if len(v_trimmed) > 125:
                    raise ValueError("Remarks must be maximum 125 characters")
            return v_trimmed
        return v


class UpdateGPUModel(BaseModel):
    gpuName: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator('gpuName')
    @classmethod
    def validate_gpu_name(cls, v):
        import re
        if v is not None:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("GPU Name cannot be empty")
            if not re.match(r"^[a-zA-Z0-9\s/+-]+$", v_trimmed):
                raise ValueError("GPU Name must contain alphanumeric characters, spaces, slashes, pluses or dashes only")
            if len(v_trimmed) > 50:
                raise ValueError("GPU Name must be maximum 50 characters")
            return v_trimmed
        return v

    @field_validator('remarks')
    @classmethod
    def validate_remarks(cls, v):
        import re
        if v is not None:
            v_trimmed = v.strip()
            if v_trimmed:
                if not re.match(r"^[a-zA-Z0-9\s,.:-]+$", v_trimmed):
                    raise ValueError("Remarks must contain alphanumeric characters, spaces, commas, periods, colons, or dashes only")
                if len(v_trimmed) > 125:
                    raise ValueError("Remarks must be maximum 125 characters")
            return v_trimmed
        return v

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )


class PaginatedGPUsModel(BaseModel):
    data: List[GPUModel]
    total: int


def gpu_serial(doc) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


@router.get("/", response_description="List all GPUs", dependencies=[Depends(require_any_privilege(["View Configurations", "Create Server Details", "View Server Details", "View All Server Details"]))])
async def list_gpus(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None,
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc")
):
    query = {}

    if search:
        query = {
            "gpuName": {"$regex": search, "$options": "i"}
        }

    actual_sort_by = sortBy or sort_by or "gpuName"
    sort_order = 1 if order == "asc" else -1

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort(actual_sort_by, sort_order)

    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
    else:
        items = await cursor.to_list(length=None)

    data = [gpu_serial(i) for i in items]
    return {"data": data, "total": total}


@router.post("/", response_description="Create a GPU", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_any_privilege(["Create Configuration", "Create Server Details"]))])
async def create_gpu(
    payload: CreateGPUModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    existing = await collection.find_one({"gpuName": {"$regex": f"^{payload.gpuName}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="GPU already exists")

    item_dict = payload.model_dump()
    item_dict["createdBy"] = current_user.get("sub", "")
    item_dict["createdAt"] = datetime.now(timezone.utc).isoformat()
    item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    new_item = await collection.insert_one(item_dict)
    created = await collection.find_one({"_id": new_item.inserted_id})
    return gpu_serial(created)


@router.put("/{id}", response_description="Update a GPU", dependencies=[Depends(require_any_privilege(["Update Configurations", "Update Server Details"]))])
async def update_gpu(id: str, payload: UpdateGPUModel = Body(...)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    item_dict = {k: v for k, v in payload.model_dump().items() if v is not None}

    if len(item_dict) >= 1:
        if "gpuName" in item_dict:
            existing = await collection.find_one({
                "gpuName": {"$regex": f"^{item_dict['gpuName']}$", "$options": "i"},
                "_id": {"$ne": ObjectId(id)}
            })
            if existing:
                raise HTTPException(status_code=400, detail="GPU already exists")

        item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

        update_result = await collection.update_one(
            {"_id": ObjectId(id)}, {"$set": item_dict}
        )

        if update_result.modified_count == 1:
            if (updated := await collection.find_one({"_id": ObjectId(id)})) is not None:
                return gpu_serial(updated)

    if (existing := await collection.find_one({"_id": ObjectId(id)})) is not None:
        return gpu_serial(existing)

    raise HTTPException(status_code=404, detail=f"GPU {id} not found")


@router.delete("/{id}", response_description="Delete a GPU", dependencies=[Depends(require_privilege("Delete Configurations"))])
async def delete_gpu(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"GPU {id} not found")
