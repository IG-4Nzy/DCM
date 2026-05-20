from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.functional_validators import BeforeValidator
from typing_extensions import Annotated
from typing import Optional, List, Any

# Represents an ObjectId field in the database.
# It will be represented as a `str` on the model so that it can be serialized to JSON.
PyObjectId = Annotated[str, BeforeValidator(str)]

class ItemModel(BaseModel):
    """
    Container for a single item record.
    """
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str = Field(...)
    description: Optional[str] = Field(default=None)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_schema_extra={
            "example": {
                "name": "Sample Item",
                "description": "This is a sample description."
            }
        },
    )

class UpdateItemModel(BaseModel):
    """
    A set of optional updates to be made to a document in the database.
    """
    name: Optional[str] = None
    description: Optional[str] = None

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        json_schema_extra={
            "example": {
                "name": "Updated Item",
                "description": "This is an updated description."
            }
        },
    )

class UserModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    username: str
    role: str
    status: bool
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    dob: Optional[str] = None
    mobile: Optional[str] = None
    bloodGroup: Optional[str] = None
    address: Optional[str] = None
    dateOfJoin: Optional[str] = None
    department: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateUserModel(BaseModel):
    username: str
    password: str
    role: str = "User"
    status: bool = True
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    dob: Optional[str] = None
    mobile: Optional[str] = None
    bloodGroup: Optional[str] = None
    address: Optional[str] = None
    dateOfJoin: Optional[str] = None
    department: Optional[str] = None

class UpdateUserModel(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    status: Optional[bool] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    dob: Optional[str] = None
    mobile: Optional[str] = None
    bloodGroup: Optional[str] = None
    address: Optional[str] = None
    dateOfJoin: Optional[str] = None
    department: Optional[str] = None
    
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedUsersModel(BaseModel):
    data: List[UserModel]
    total: int

class RoleModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str
    status: bool
    privileges: List[str] = Field(default_factory=list)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateRoleModel(BaseModel):
    name: str
    status: bool = True
    privileges: List[str] = Field(default_factory=list)

class UpdateRoleModel(BaseModel):
    name: Optional[str] = None
    status: Optional[bool] = None
    privileges: Optional[List[str]] = None
    
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedRolesModel(BaseModel):
    data: List[RoleModel]
    total: int

class WorkModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    workName: str
    assignee: str
    priority: str
    dueDate: str
    description: str
    attachments: List[dict] = Field(default_factory=list)
    status: str = "Pending"
    comments: List[dict] = Field(default_factory=list)

    @field_validator('attachments', mode='before')
    @classmethod
    def parse_attachments(cls, v: Any) -> List[dict]:
        if not isinstance(v, list):
            return []
        parsed = []
        for a in v:
            if isinstance(a, str):
                parsed.append({"name": a, "url": f"/{a}"})
            elif isinstance(a, dict):
                parsed.append(a)
        return parsed

    @field_validator('comments', mode='before')
    @classmethod
    def parse_comments(cls, v: Any) -> List[dict]:
        if not isinstance(v, list):
            return []
        parsed = []
        for c in v:
            if isinstance(c, str):
                parsed.append({"text": c, "user": "Unknown", "timestamp": "2023-01-01T00:00:00.000Z"})
            elif isinstance(c, dict):
                parsed.append(c)
        return parsed

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateWorkModel(BaseModel):
    workName: str
    assignee: str
    priority: str
    dueDate: str
    description: str
    attachments: List[dict] = Field(default_factory=list)
    status: str = "Pending"
    comments: List[dict] = Field(default_factory=list)

class UpdateWorkModel(BaseModel):
    workName: Optional[str] = None
    assignee: Optional[str] = None
    priority: Optional[str] = None
    dueDate: Optional[str] = None
    description: Optional[str] = None
    attachments: Optional[List[dict]] = None
    status: Optional[str] = None
    comments: Optional[List[dict]] = None

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedWorksModel(BaseModel):
    data: List[WorkModel]
    total: int

class DepartmentModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str
    status: bool
    departmentHead: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateDepartmentModel(BaseModel):
    name: str
    status: bool = True
    departmentHead: Optional[str] = None

class UpdateDepartmentModel(BaseModel):
    name: Optional[str] = None
    status: Optional[bool] = None
    departmentHead: Optional[str] = None
    
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedDepartmentsModel(BaseModel):
    data: List[DepartmentModel]
    total: int

class RoasterModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    date: str
    shift: str
    assignees: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    createdBy: Optional[str] = None
    updatedAt: Optional[str] = None
    updatedByFullName: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateRoasterModel(BaseModel):
    date: str
    shift: str
    assignees: List[str] = Field(default_factory=list)
    notes: Optional[str] = None

class UpdateRoasterModel(BaseModel):
    date: Optional[str] = None
    shift: Optional[str] = None
    assignees: Optional[List[str]] = None
    notes: Optional[str] = None

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedRoastersModel(BaseModel):
    data: List[RoasterModel]
    total: int

class RoasterStatusModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    weekStartDate: str
    department: str
    status: str
    updatedByFullName: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateRoasterStatusModel(BaseModel):
    weekStartDate: str
    department: str
    status: str
