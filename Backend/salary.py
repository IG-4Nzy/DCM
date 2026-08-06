from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, model_validator
from typing import List, Optional, Union
from database import db
from auth_utils import get_current_user

router = APIRouter()

class ActivityModel(BaseModel):
    id: str
    name: str
    rate: Union[float, str]
    maxUnits: Optional[Union[float, str]] = 0

class TemplateModel(BaseModel):
    id: str
    title: str
    activities: List[ActivityModel] = []
    allottedAmount: Optional[Union[float, str]] = 0
    maxStaffs: Optional[Union[int, str]] = 0
    initialConsumedAmount: Optional[Union[float, str]] = 0
    reserveEnabled: Optional[bool] = False
    reserveType: Optional[str] = 'percentage'
    reserveValue: Optional[Union[float, str]] = 5

    @model_validator(mode='before')
    @classmethod
    def populate_initial_consumed_amount(cls, data):
        if isinstance(data, dict):
            if 'initialConsumedUnits' in data and 'initialConsumedAmount' not in data:
                data['initialConsumedAmount'] = data.get('initialConsumedUnits', 0)
        return data

class MemberModel(BaseModel):
    id: str
    name: str
    days: Union[float, str]
    otHours: Optional[Union[float, str]] = 0

class GroupModel(BaseModel):
    id: str
    name: str
    perDaySalary: Union[float, str]
    templateId: Optional[str] = None
    members: List[MemberModel] = []
    updatedBy: Optional[str] = None
    updatedAt: Optional[str] = None

class SalaryMonthModel(BaseModel):
    month: str
    groups: List[GroupModel]

class GlobalSalaryConfig(BaseModel):
    companyName: str = ""
    poNumber: str = ""
    poStartDate: Optional[str] = ""
    poEndDate: Optional[str] = ""

@router.get("/config", response_model=GlobalSalaryConfig)
async def get_config():
    doc = await db["salary_config"].find_one({"_id": "global"})
    if doc:
        return GlobalSalaryConfig(**doc)
    return GlobalSalaryConfig()

@router.post("/config")
async def save_config(config: GlobalSalaryConfig, user=Depends(get_current_user)):
    await db["salary_config"].update_one(
        {"_id": "global"},
        {"$set": config.model_dump()},
        upsert=True
    )
    return {"message": "Config saved"}

@router.get("/templates", response_model=List[TemplateModel])
async def get_templates():
    cursor = db["salary_templates"].find({})
    templates = []
    async for doc in cursor:
        templates.append(TemplateModel(**doc))
    return templates

@router.post("/templates")
async def save_templates(templates: List[TemplateModel], user=Depends(get_current_user)):
    await db["salary_templates"].delete_many({})
    if templates:
        docs = [t.model_dump() for t in templates]
        await db["salary_templates"].insert_many(docs)
    return {"message": "Templates saved"}

@router.get("", response_model=List[SalaryMonthModel])
async def get_all_salary():
    cursor = db["salary_data"].find({})
    res = []
    async for doc in cursor:
        res.append(SalaryMonthModel(month=doc["_id"], groups=doc.get("groups", [])))
    return res

@router.get("/{month}", response_model=List[GroupModel])
async def get_salary(month: str):
    doc = await db["salary_data"].find_one({"_id": month})
    if doc and "groups" in doc:
        return [GroupModel(**g) for g in doc["groups"]]
    return []

@router.post("/{month}")
async def save_salary(month: str, groups: List[GroupModel], user=Depends(get_current_user)):
    await db["salary_data"].update_one(
        {"_id": month},
        {"$set": {"groups": [g.model_dump() for g in groups]}},
        upsert=True
    )
    return {"message": "Salary saved"}
