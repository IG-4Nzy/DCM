import os
import shutil
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Form, UploadFile, File, Depends, Query
from auth_utils import get_current_user, require_privilege
from database import db
from bson import ObjectId
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List

router = APIRouter()
collection = db.get_collection("documentations")

class DocumentationModel(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    title: str
    fileName: str
    fileUrl: str
    createdAt: str

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class PaginatedDocumentationsModel(BaseModel):
    data: List[DocumentationModel]
    total: int

@router.post("/", response_description="Create documentation", response_model=DocumentationModel, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_privilege("Create Documentation"))])
async def create_documentation(
    title: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    base_dir = "uploads/documentations"
    os.makedirs(base_dir, exist_ok=True)
    
    file_ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(base_dir, unique_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    doc_dict = {
        "title": title,
        "fileName": file.filename,
        "fileUrl": f"/uploads/documentations/{unique_name}",
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    }
    
    result = await collection.insert_one(doc_dict)
    created_doc = await collection.find_one({"_id": result.inserted_id})
    created_doc["_id"] = str(created_doc["_id"])

    from notification_helper import log_page_update
    await log_page_update("documentations", username=current_user.get("sub"))

    return created_doc

@router.get("/", response_description="List documentations", response_model=PaginatedDocumentationsModel, dependencies=[Depends(require_privilege("View Documentation"))])
async def list_documentations(
    pagination: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        query["title"] = {"$regex": search, "$options": "i"}
        
    total = await collection.count_documents(query)
    cursor = collection.find(query).sort("createdAt", -1)
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
    
    data = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        data.append(doc)
        
    return {"data": data, "total": total}

@router.put("/{id}", response_description="Update documentation", response_model=DocumentationModel, dependencies=[Depends(require_privilege("Update Documentation"))])
async def update_documentation(
    id: str,
    title: str = Form(...),
    file: Optional[UploadFile] = File(default=None),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Documentation not found")
        
    update_data = {"title": title}
    
    if file:
        old_url = existing.get("fileUrl")
        if old_url:
            old_path = old_url.lstrip("/")
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except Exception as e:
                    print(f"Failed to delete old file: {e}")
                    
        base_dir = "uploads/documentations"
        file_ext = os.path.splitext(file.filename)[1]
        unique_name = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(base_dir, unique_name)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        update_data["fileName"] = file.filename
        update_data["fileUrl"] = f"/uploads/documentations/{unique_name}"
        
    await collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    updated_doc = await collection.find_one({"_id": ObjectId(id)})
    updated_doc["_id"] = str(updated_doc["_id"])

    from notification_helper import log_page_update
    await log_page_update("documentations", username=current_user.get("sub"))

    return updated_doc

@router.delete("/{id}", response_description="Delete documentation", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_privilege("Delete Documentation"))])
async def delete_documentation(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Documentation not found")
        
    file_url = existing.get("fileUrl")
    if file_url:
        file_path = file_url.lstrip("/")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Failed to delete file: {e}")
                
    await collection.delete_one({"_id": ObjectId(id)})
    return
