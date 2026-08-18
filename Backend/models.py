from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.functional_validators import BeforeValidator
from typing_extensions import Annotated
from typing import Optional, List, Any, Union

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
    role: Union[List[str], str]
    status: bool
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    dob: Optional[str] = None
    mobile: Optional[str] = None
    bloodGroup: Optional[str] = None
    address: Optional[str] = None
    dateOfJoin: Optional[str] = None
    department: Optional[str] = None
    is_superuser: Optional[bool] = None
    isDepartmentHead: Optional[bool] = None
    replacementFor: Optional[str] = None
    replacementForName: Optional[str] = None
    passNumber: Optional[str] = None
    lastActive: Optional[str] = None
    isMonitorUser: Optional[bool] = None
    activated: Optional[bool] = Field(default=True)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

def check_username(v: Optional[str]) -> Optional[str]:
    if v is not None:
        v_trimmed = v.strip()
        if not all(c.isalnum() or c == '_' for c in v_trimmed):
            raise ValueError("Username must contain alphabets, underscore, and numbers only")
        if len(v_trimmed) > 20:
            raise ValueError("Username must be maximum 20 characters")
        return v_trimmed
    return v

def check_password(v: Optional[str]) -> Optional[str]:
    if v is not None:
        if len(v) > 20:
            raise ValueError("Password must be maximum 20 characters")
    return v

def check_status(v: Any) -> bool:
    if isinstance(v, str):
        val_str = v.lower().strip()
        if val_str not in ['active', 'inactive']:
            raise ValueError("Status must be 'active' or 'inactive'")
        return val_str == 'active'
    if isinstance(v, bool):
        return v
    raise ValueError("Status must be 'active', 'inactive', true, or false")

def check_first_name(v: Optional[str]) -> Optional[str]:
    if v:
        v_trimmed = v.strip()
        if not v_trimmed.isalnum():
            raise ValueError("First name must be alphanumeric only")
        if len(v_trimmed) > 20:
            raise ValueError("First name must be maximum 20 characters")
        return v_trimmed
    return v

def check_last_name(v: Optional[str]) -> Optional[str]:
    if v:
        v_trimmed = v.strip()
        if not v_trimmed.isalnum():
            raise ValueError("Last name must be alphanumeric only")
        if len(v_trimmed) > 20:
            raise ValueError("Last name must be maximum 20 characters")
        return v_trimmed
    return v

def check_mobile(v: Optional[str]) -> Optional[str]:
    if v:
        v_trimmed = v.strip()
        if not all(c.isdigit() or c == ',' for c in v_trimmed):
            raise ValueError("Mobile number must contain numbers and commas only")
        return v_trimmed
    return v

def check_pass_number(v: Optional[str]) -> Optional[str]:
    if v:
        v_trimmed = v.strip()
        if not v_trimmed.isalnum():
            raise ValueError("Pass number must be alphanumeric only")
        if len(v_trimmed) > 15:
            raise ValueError("Pass number must be maximum 15 characters")
        return v_trimmed
    return v

def check_date_of_join(v: Optional[str]) -> Optional[str]:
    if v:
        from datetime import datetime, date
        try:
            date_str = v.split('T')[0]
            parsed_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            if parsed_date > date.today():
                raise ValueError("Date of join cannot be a future date")
        except ValueError as e:
            if "future date" in str(e):
                raise
    return v

def check_role_name(v: Optional[str]) -> Optional[str]:
    if v is not None:
        if not all(c.isalnum() or c.isspace() for c in v):
            raise ValueError("Role name must be alphanumeric and spaces only")
        if not (2 <= len(v) <= 30):
            raise ValueError("Role name must be between 2 to 30 characters")
    return v

def check_department_name(v: Optional[str]) -> Optional[str]:
    if v is not None:
        if not all(c.isalnum() or c.isspace() or c == '-' for c in v):
            raise ValueError("Department name must be alphanumeric with spaces or dashes only")
        if not (2 <= len(v) <= 50):
            raise ValueError("Department name must be between 2 to 50 characters")
    return v

def check_inventory_item_name(v: Optional[str]) -> Optional[str]:
    if v is not None:
        v_trimmed = v.strip()
        if not v_trimmed.isalnum():
            raise ValueError("Item name must be alphanumeric only")
        if len(v_trimmed) > 20:
            raise ValueError("Item name must be maximum 20 characters")
        return v_trimmed
    return v

def check_almira_number(v: Optional[str]) -> Optional[str]:
    if v:
        v_trimmed = v.strip()
        if not v_trimmed.isalnum():
            raise ValueError("Almira number must be alphanumeric only")
        if len(v_trimmed) > 5:
            raise ValueError("Almira number must be maximum 5 characters")
        return v_trimmed
    return v

def check_rack_number(v: Optional[str]) -> Optional[str]:
    if v:
        v_trimmed = v.strip()
        if not v_trimmed.isalnum():
            raise ValueError("Rack number must be alphanumeric only")
        if len(v_trimmed) > 5:
            raise ValueError("Rack number must be maximum 5 characters")
        return v_trimmed
    return v

def check_inventory_description(v: Optional[str]) -> Optional[str]:
    if v:
        v_trimmed = v.strip()
        if len(v_trimmed) > 220:
            raise ValueError("Description must be maximum 220 characters")
        return v_trimmed
    return v

def check_inventory_quantity(v: Optional[int]) -> Optional[int]:
    if v is not None:
        if v < 0:
            raise ValueError("Quantity must be greater than or equal to 0")
    return v

def check_give_quantity(v: int) -> int:
    if v <= 0:
        raise ValueError("Give quantity must be greater than 0")
    return v

def check_observation_description(v: Optional[str]) -> Optional[str]:
    if v is not None:
        if len(v) > 1000:
            raise ValueError("Description must be maximum 1000 characters")
    return v

class CreateUserModel(BaseModel):
    username: str
    password: str
    role: Union[List[str], str] = "User"
    status: bool = True
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    dob: Optional[str] = None
    mobile: Optional[str] = None
    bloodGroup: Optional[str] = None
    address: Optional[str] = None
    dateOfJoin: Optional[str] = None
    department: Optional[str] = None
    isDepartmentHead: Optional[bool] = None
    replacementFor: Optional[str] = None
    passNumber: Optional[str] = None
    lastActive: Optional[str] = None
    isMonitorUser: Optional[bool] = None
    activated: bool = Field(default=False)

    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        return check_username(v)

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        return check_password(v)

    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        return check_status(v)

    @field_validator('firstName')
    @classmethod
    def validate_first_name(cls, v):
        return check_first_name(v)

    @field_validator('lastName')
    @classmethod
    def validate_last_name(cls, v):
        return check_last_name(v)

    @field_validator('mobile')
    @classmethod
    def validate_mobile(cls, v):
        return check_mobile(v)

    @field_validator('dateOfJoin')
    @classmethod
    def validate_date_of_join(cls, v):
        return check_date_of_join(v)

    @field_validator('passNumber')
    @classmethod
    def validate_pass_number(cls, v):
        return check_pass_number(v)

class UpdateUserModel(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[Union[List[str], str]] = None
    status: Optional[bool] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    dob: Optional[str] = None
    mobile: Optional[str] = None
    bloodGroup: Optional[str] = None
    address: Optional[str] = None
    dateOfJoin: Optional[str] = None
    department: Optional[str] = None
    isDepartmentHead: Optional[bool] = None
    replacementFor: Optional[str] = None
    passNumber: Optional[str] = None
    lastActive: Optional[str] = None
    isMonitorUser: Optional[bool] = None
    activated: Optional[bool] = None

    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        return check_username(v)

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        return check_password(v)

    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        return check_status(v)

    @field_validator('firstName')
    @classmethod
    def validate_first_name(cls, v):
        return check_first_name(v)

    @field_validator('lastName')
    @classmethod
    def validate_last_name(cls, v):
        return check_last_name(v)

    @field_validator('mobile')
    @classmethod
    def validate_mobile(cls, v):
        return check_mobile(v)

    @field_validator('dateOfJoin')
    @classmethod
    def validate_date_of_join(cls, v):
        return check_date_of_join(v)

    @field_validator('passNumber')
    @classmethod
    def validate_pass_number(cls, v):
        return check_pass_number(v)
    
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
    lateLoginPrivileges: List[str] = Field(default_factory=list)
    usersCount: Optional[int] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateRoleModel(BaseModel):
    name: str
    status: bool = True
    privileges: List[str] = Field(default_factory=list)
    lateLoginPrivileges: List[str] = Field(default_factory=list)
    usersCount: Optional[int] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        return check_role_name(v)

class UpdateRoleModel(BaseModel):
    name: Optional[str] = None
    status: Optional[bool] = None
    privileges: Optional[List[str]] = None
    lateLoginPrivileges: Optional[List[str]] = None
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        return check_role_name(v)
    
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedRolesModel(BaseModel):
    data: List[RoleModel]
    total: int

class WorkModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    workId: Optional[str] = None
    workName: str
    assignees: List[str] = Field(default_factory=list)
    assigneesFullName: Optional[str] = None
    assignee: Optional[str] = None
    priority: str
    dueDate: str = ""
    description: str = ""
    attachments: List[dict] = Field(default_factory=list)
    status: str = "Pending"
    comments: List[dict] = Field(default_factory=list)
    completedAt: Optional[str] = None
    createdAt: Optional[str] = None
    isEmergency: bool = False
    approved: bool = True
    createdBy: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def convert_assignee_to_assignees(cls, data: Any) -> Any:
        if isinstance(data, dict):
            assignee = data.get("assignee")
            assignees = data.get("assignees")
            if not assignees and assignee:
                data["assignees"] = [assignee]
            elif "assignees" not in data:
                data["assignees"] = []
            if not assignee and data["assignees"]:
                data["assignee"] = data["assignees"][0]
        return data

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
    workId: Optional[str] = None
    workName: str
    assignees: List[str] = Field(default_factory=list)
    assigneesFullName: Optional[str] = None
    assignee: Optional[str] = None
    priority: str
    dueDate: str = ""
    description: str = ""
    attachments: List[dict] = Field(default_factory=list)
    status: str = "Pending"
    comments: List[dict] = Field(default_factory=list)
    completedAt: Optional[str] = None
    createdAt: Optional[str] = None
    isEmergency: bool = False
    approved: bool = True
    createdBy: Optional[str] = None

    @field_validator('workName')
    @classmethod
    def validate_work_name(cls, v):
        import re
        if v:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Work title cannot be empty")
            if not re.match(r"^[a-zA-Z0-9\s]+$", v_trimmed):
                raise ValueError("Work title must contain alphanumeric characters and spaces only")
            if len(v_trimmed) > 100:
                raise ValueError("Work title must be maximum 100 characters")
            return v_trimmed
        return v

    @field_validator('description')
    @classmethod
    def validate_description(cls, v):
        if v is not None:
            v_trimmed = v.strip()
            if len(v_trimmed) > 220:
                raise ValueError("Description must be maximum 220 characters")
            return v_trimmed
        return v

    @model_validator(mode='before')
    @classmethod
    def convert_assignee_to_assignees(cls, data: Any) -> Any:
        if isinstance(data, dict):
            assignee = data.get("assignee")
            assignees = data.get("assignees")
            if not assignees and assignee:
                data["assignees"] = [assignee]
            elif "assignees" not in data:
                data["assignees"] = []
            if not assignee and data["assignees"]:
                data["assignee"] = data["assignees"][0]
        return data

class UpdateWorkModel(BaseModel):
    workId: Optional[str] = None
    workName: Optional[str] = None
    assignees: Optional[List[str]] = None
    assignee: Optional[str] = None
    priority: Optional[str] = None
    dueDate: Optional[str] = None
    description: Optional[str] = None
    attachments: Optional[List[dict]] = None
    status: Optional[str] = None
    comments: Optional[List[dict]] = None
    completedAt: Optional[str] = None
    createdAt: Optional[str] = None
    isEmergency: Optional[bool] = None
    approved: Optional[bool] = None
    createdBy: Optional[str] = None

    @field_validator('workName')
    @classmethod
    def validate_work_name(cls, v):
        import re
        if v is not None:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Work title cannot be empty")
            if not re.match(r"^[a-zA-Z0-9\s]+$", v_trimmed):
                raise ValueError("Work title must contain alphanumeric characters and spaces only")
            if len(v_trimmed) > 100:
                raise ValueError("Work title must be maximum 100 characters")
            return v_trimmed
        return v

    @field_validator('description')
    @classmethod
    def validate_description(cls, v):
        if v is not None:
            v_trimmed = v.strip()
            if len(v_trimmed) > 220:
                raise ValueError("Description must be maximum 220 characters")
            return v_trimmed
        return v

    @model_validator(mode='before')
    @classmethod
    def convert_assignee_to_assignees(cls, data: Any) -> Any:
        if isinstance(data, dict):
            assignee = data.get("assignee")
            assignees = data.get("assignees")
            if assignees is not None:
                if len(assignees) > 0:
                    data["assignee"] = assignees[0]
            elif assignee is not None:
                data["assignees"] = [assignee]
        return data

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedWorksModel(BaseModel):
    data: List[WorkModel]
    total: int

class WorkLogEntryModel(BaseModel):
    id: Optional[str] = None
    startTime: str
    endTime: str
    activity: str

class WorkLogModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    date: str
    username: str
    userId: Optional[str] = None
    userFullName: Optional[str] = None
    department: Optional[str] = None
    entries: List[WorkLogEntryModel] = Field(default_factory=list)
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateWorkLogModel(BaseModel):
    date: str
    username: Optional[str] = None
    entries: List[WorkLogEntryModel] = Field(default_factory=list)

class UpdateWorkLogModel(BaseModel):
    date: Optional[str] = None
    username: Optional[str] = None
    entries: Optional[List[WorkLogEntryModel]] = None

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedWorkLogsModel(BaseModel):
    data: List[WorkLogModel]
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

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        return check_department_name(v)

class UpdateDepartmentModel(BaseModel):
    name: Optional[str] = None
    status: Optional[bool] = None
    departmentHead: Optional[str] = None
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        return check_department_name(v)
    
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
    department: Optional[str] = None
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
    department: Optional[str] = None
    notes: Optional[str] = None

class UpdateRoasterModel(BaseModel):
    date: Optional[str] = None
    shift: Optional[str] = None
    assignees: Optional[List[str]] = None
    department: Optional[str] = None
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
    emailSent: Optional[bool] = False

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateRoasterStatusModel(BaseModel):
    weekStartDate: str
    department: str
    status: str

class ObservationCategoryModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str
    status: bool = True
    reportsTo: Optional[str] = None
    remarks: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateObservationCategoryModel(BaseModel):
    name: str
    status: bool = True
    reportsTo: Optional[str] = None
    remarks: Optional[str] = None

class UpdateObservationCategoryModel(BaseModel):
    name: Optional[str] = None
    status: Optional[bool] = None
    reportsTo: Optional[str] = None
    remarks: Optional[str] = None

class PaginatedObservationCategoriesModel(BaseModel):
    data: List[ObservationCategoryModel]
    total: int

class ObservationModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    observationId: str
    observedDate: str
    observedTime: str
    category: str
    description: str
    amc: Optional[str] = ""
    informedTo: Union[str, List[str]]
    informedToOther: Optional[str] = None
    loggedBy: str
    status: str = "Not Resolved"
    remarks: Optional[str] = ""
    actionsTaken: Optional[str] = ""
    comments: List[dict] = Field(default_factory=list)
    isRepeated: Optional[bool] = False
    repeatedFromId: Optional[str] = None
    repeatCount: Optional[int] = 0
    repeatedDetails: Optional[dict] = None
    lastStatusUpdatedOn: Optional[str] = None

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

class CreateObservationModel(BaseModel):
    observedDate: str
    observedTime: str
    category: str
    description: str
    amc: Optional[str] = ""
    informedTo: Union[str, List[str]]
    informedToOther: Optional[str] = None
    loggedBy: str
    status: str = "Not Resolved"
    remarks: Optional[str] = ""
    actionsTaken: Optional[str] = ""
    comments: List[dict] = Field(default_factory=list)
    isRepeated: Optional[bool] = False
    repeatedFromId: Optional[str] = None

    @field_validator('description')
    @classmethod
    def validate_description(cls, v):
        return check_observation_description(v)

class UpdateObservationModel(BaseModel):
    observedDate: Optional[str] = None
    observedTime: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    amc: Optional[str] = None
    informedTo: Optional[Union[str, List[str]]] = None
    informedToOther: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None
    actionsTaken: Optional[str] = None
    comments: Optional[List[dict]] = None
    isRepeated: Optional[bool] = None
    repeatedFromId: Optional[str] = None

    @field_validator('description')
    @classmethod
    def validate_description(cls, v):
        return check_observation_description(v)

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedObservationsModel(BaseModel):
    data: List[ObservationModel]
    total: int

class InventoryHistoryModel(BaseModel):
    date: str
    action: str
    quantityChange: int
    remainingQuantity: int
    givenTo: Optional[str] = None
    user: str

    model_config = ConfigDict(arbitrary_types_allowed=True)

class HolderModel(BaseModel):
    id: str
    givenTo: str
    givenDate: str
    givenBy: str

class InventoryModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    itemName: str
    quantity: int
    description: Optional[str] = None
    department: Optional[str] = None
    lastUpdatedDate: str
    lastUpdatedBy: str
    history: List[InventoryHistoryModel] = []
    isReturnable: Optional[bool] = False
    currentHolders: List[HolderModel] = []
    almiraNumber: Optional[str] = None
    rackNumber: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateInventoryModel(BaseModel):
    itemName: str
    quantity: int
    description: Optional[str] = None
    date: str
    isReturnable: Optional[bool] = False
    almiraNumber: Optional[str] = None
    rackNumber: Optional[str] = None

    @field_validator('itemName')
    @classmethod
    def validate_item_name(cls, v):
        return check_inventory_item_name(v)

    @field_validator('quantity')
    @classmethod
    def validate_quantity(cls, v):
        return check_inventory_quantity(v)

    @field_validator('almiraNumber')
    @classmethod
    def validate_almira_number(cls, v):
        return check_almira_number(v)

    @field_validator('rackNumber')
    @classmethod
    def validate_rack_number(cls, v):
        return check_rack_number(v)

    @field_validator('description')
    @classmethod
    def validate_description(cls, v):
        return check_inventory_description(v)

class UpdateInventoryModel(BaseModel):
    quantityChange: int
    action: str
    givenTo: Optional[str] = None
    date: str

class EditInventoryModel(BaseModel):
    itemName: str
    quantity: int
    description: Optional[str] = ""
    isReturnable: Optional[bool] = False
    almiraNumber: Optional[str] = ""
    rackNumber: Optional[str] = ""

    @field_validator('itemName')
    @classmethod
    def validate_item_name(cls, v):
        return check_inventory_item_name(v)

    @field_validator('quantity')
    @classmethod
    def validate_quantity(cls, v):
        return check_inventory_quantity(v)

    @field_validator('almiraNumber')
    @classmethod
    def validate_almira_number(cls, v):
        return check_almira_number(v)

    @field_validator('rackNumber')
    @classmethod
    def validate_rack_number(cls, v):
        return check_rack_number(v)

    @field_validator('description')
    @classmethod
    def validate_description(cls, v):
        return check_inventory_description(v)

class InventoryGiveModel(BaseModel):
    givenTo: str
    date: str
    quantity: int = 1

    @field_validator('quantity')
    @classmethod
    def validate_quantity(cls, v):
        return check_give_quantity(v)


class InventoryReturnModel(BaseModel):
    holderId: str
    date: str

class PaginatedInventoryModel(BaseModel):
    data: List[InventoryModel]
    total: int

class ClusterTypeModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    clusterType: str
    remarks: Optional[str] = None
    createdBy: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateClusterTypeModel(BaseModel):
    clusterType: str
    remarks: Optional[str] = None

    @field_validator('clusterType')
    @classmethod
    def validate_cluster_type(cls, v):
        import re
        if v:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Cluster type cannot be empty")
            if not re.match(r"^[a-zA-Z0-9\s]+$", v_trimmed):
                raise ValueError("Cluster type must contain alphanumeric characters and spaces only")
            if len(v_trimmed) > 50:
                raise ValueError("Cluster type must be maximum 50 characters")
            return v_trimmed
        return v

    @field_validator('remarks')
    @classmethod
    def validate_remarks(cls, v):
        import re
        if v is not None:
            v_trimmed = v.strip()
            if v_trimmed:
                if not re.match(r"^[a-zA-Z0-9\s,.-]+$", v_trimmed):
                    raise ValueError("Remarks must contain alphanumeric characters, spaces, commas, periods, or dashes only")
                if len(v_trimmed) > 125:
                    raise ValueError("Remarks must be maximum 125 characters")
            return v_trimmed
        return v

class UpdateClusterTypeModel(BaseModel):
    clusterType: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator('clusterType')
    @classmethod
    def validate_cluster_type(cls, v):
        import re
        if v is not None:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Cluster type cannot be empty")
            if not re.match(r"^[a-zA-Z0-9\s]+$", v_trimmed):
                raise ValueError("Cluster type must contain alphanumeric characters and spaces only")
            if len(v_trimmed) > 50:
                raise ValueError("Cluster type must be maximum 50 characters")
            return v_trimmed
        return v

    @field_validator('remarks')
    @classmethod
    def validate_remarks(cls, v):
        import re
        if v is not None:
            v_trimmed = v.strip()
            if v_trimmed:
                if not re.match(r"^[a-zA-Z0-9\s,.-]+$", v_trimmed):
                    raise ValueError("Remarks must contain alphanumeric characters, spaces, commas, periods, or dashes only")
                if len(v_trimmed) > 125:
                    raise ValueError("Remarks must be maximum 125 characters")
            return v_trimmed
        return v
    
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedClusterTypesModel(BaseModel):
    data: List[ClusterTypeModel]
    total: int

class HypervisorModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    hypervisor: str
    remarks: Optional[str] = None
    createdBy: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateHypervisorModel(BaseModel):
    hypervisor: str
    remarks: Optional[str] = None

    @field_validator('hypervisor')
    @classmethod
    def validate_hypervisor(cls, v):
        import re
        if v:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Hypervisor cannot be empty")
            if not re.match(r"^[a-zA-Z0-9\s]+$", v_trimmed):
                raise ValueError("Hypervisor must contain alphanumeric characters and spaces only")
            if len(v_trimmed) > 50:
                raise ValueError("Hypervisor must be maximum 50 characters")
            return v_trimmed
        return v

    @field_validator('remarks')
    @classmethod
    def validate_remarks(cls, v):
        import re
        if v is not None:
            v_trimmed = v.strip()
            if v_trimmed:
                if not re.match(r"^[a-zA-Z0-9\s,.-]+$", v_trimmed):
                    raise ValueError("Remarks must contain alphanumeric characters, spaces, commas, periods, or dashes only")
                if len(v_trimmed) > 125:
                    raise ValueError("Remarks must be maximum 125 characters")
            return v_trimmed
        return v

class UpdateHypervisorModel(BaseModel):
    hypervisor: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator('hypervisor')
    @classmethod
    def validate_hypervisor(cls, v):
        import re
        if v is not None:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Hypervisor cannot be empty")
            if not re.match(r"^[a-zA-Z0-9\s]+$", v_trimmed):
                raise ValueError("Hypervisor must contain alphanumeric characters and spaces only")
            if len(v_trimmed) > 50:
                raise ValueError("Hypervisor must be maximum 50 characters")
            return v_trimmed
        return v

    @field_validator('remarks')
    @classmethod
    def validate_remarks(cls, v):
        import re
        if v is not None:
            v_trimmed = v.strip()
            if v_trimmed:
                if not re.match(r"^[a-zA-Z0-9\s,.-]+$", v_trimmed):
                    raise ValueError("Remarks must contain alphanumeric characters, spaces, commas, periods, or dashes only")
                if len(v_trimmed) > 125:
                    raise ValueError("Remarks must be maximum 125 characters")
            return v_trimmed
        return v
    
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedHypervisorsModel(BaseModel):
    data: List[HypervisorModel]
    total: int

class NodeModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    nodeId: Optional[str] = None
    node: Optional[str] = None
    remarks: Optional[str] = None
    totalRam: Optional[Union[int, str]] = None
    totalHardisk: Optional[Union[int, str]] = None
    totalCpu: Optional[Union[int, str]] = None
    availableRam: Optional[Union[int, str]] = None
    availableHardisk: Optional[Union[int, str]] = None
    availableCpu: Optional[Union[int, str]] = None
    rack: Optional[str] = None
    rackPosition: Optional[str] = None
    rackUnits: Optional[int] = None
    clusterId: Optional[str] = None
    clusterName: Optional[str] = None
    serverModel: Optional[str] = None
    serialNumber: Optional[str] = None
    custodian: Optional[str] = None
    admin: Optional[Union[str, List[str]]] = None
    assetNumber: Optional[str] = None
    raidConfiguration: List[str] = Field(default_factory=list)
    ip: Optional[str] = None
    isAppliance: Optional[bool] = False
    isStorage: Optional[bool] = False
    isPhysical: Optional[bool] = False
    os: Optional[str] = None
    gpu: Optional[str] = None
    networkType: Optional[str] = "intranet"
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedBy: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateNodeModel(BaseModel):
    nodeId: Optional[str] = None
    node: Optional[str] = None
    remarks: Optional[str] = None
    totalRam: Optional[Union[int, str]] = None
    totalHardisk: Optional[Union[int, str]] = None
    totalCpu: Optional[Union[int, str]] = None
    rack: Optional[str] = None
    rackPosition: Optional[str] = None
    rackUnits: Optional[int] = None
    clusterId: Optional[str] = None
    serverModel: Optional[str] = None
    serialNumber: Optional[str] = None
    custodian: Optional[str] = None
    admin: Optional[Union[str, List[str]]] = None
    assetNumber: Optional[str] = None
    raidConfiguration: Optional[List[str]] = Field(default_factory=list)
    ip: Optional[str] = None
    isAppliance: Optional[bool] = False
    isStorage: Optional[bool] = False
    isPhysical: Optional[bool] = False
    os: Optional[str] = None
    gpu: Optional[str] = None
    networkType: Optional[str] = "intranet"

class UpdateNodeModel(BaseModel):
    nodeId: Optional[str] = None
    node: Optional[str] = None
    remarks: Optional[str] = None
    totalRam: Optional[Union[int, str]] = None
    totalHardisk: Optional[Union[int, str]] = None
    totalCpu: Optional[Union[int, str]] = None
    rack: Optional[str] = None
    rackPosition: Optional[str] = None
    rackUnits: Optional[int] = None
    clusterId: Optional[str] = None
    serverModel: Optional[str] = None
    serialNumber: Optional[str] = None
    custodian: Optional[str] = None
    admin: Optional[Union[str, List[str]]] = None
    assetNumber: Optional[str] = None
    raidConfiguration: Optional[List[str]] = None
    ip: Optional[str] = None
    isAppliance: Optional[bool] = None
    isStorage: Optional[bool] = None
    isPhysical: Optional[bool] = None
    os: Optional[str] = None
    gpu: Optional[str] = None
    networkType: Optional[str] = None
    
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedNodesModel(BaseModel):
    data: List[NodeModel]
    total: int

class ServerRackModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    serverRack: Optional[str] = None
    networksAvailable: List[str] = Field(default_factory=list)
    rackCapacity: Optional[int] = None
    remainingCapacity: Optional[int] = None
    temperature: Optional[float] = None
    fanAvailable: Optional[bool] = False
    sparePowerAvailability: Optional[bool] = False
    sparePowerC30: Optional[str] = None
    sparePowerC90: Optional[str] = None
    remarks: Optional[str] = None
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedBy: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateServerRackModel(BaseModel):
    serverRack: Optional[str] = None
    networksAvailable: List[str] = Field(default_factory=list)
    rackCapacity: Optional[int] = None
    temperature: Optional[float] = None
    fanAvailable: Optional[bool] = False
    sparePowerAvailability: Optional[bool] = False
    sparePowerC30: Optional[str] = None
    sparePowerC90: Optional[str] = None
    remarks: Optional[str] = None

class UpdateServerRackModel(BaseModel):
    serverRack: Optional[str] = None
    networksAvailable: Optional[List[str]] = None
    rackCapacity: Optional[int] = None
    temperature: Optional[float] = None
    fanAvailable: Optional[bool] = None
    sparePowerAvailability: Optional[bool] = None
    sparePowerC30: Optional[str] = None
    sparePowerC90: Optional[str] = None
    remarks: Optional[str] = None
    
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedServerRacksModel(BaseModel):
    data: List[ServerRackModel]
    total: int

class ServerModelModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    serverModel: str
    remarks: Optional[str] = None
    createdBy: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateServerModelModel(BaseModel):
    serverModel: str
    remarks: Optional[str] = None

class UpdateServerModelModel(BaseModel):
    serverModel: Optional[str] = None
    remarks: Optional[str] = None
    
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedServerModelsModel(BaseModel):
    data: List[ServerModelModel]
    total: int

class NodeDetailsModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    nodeId: Optional[str] = None
    clusterId: str
    slNumber: str
    rack: str
    hostName: str
    ipAddress: str
    serverModel: str
    serialNumber: str
    admin: Optional[Union[str, List[str]]] = None
    adminCode: str
    hypervisor: str
    applications: str
    clusterType: str
    indentor: str
    poNum: str
    assetNum: str
    custodian: str
    redundancyPower: str
    totalRam: Optional[Union[int, str]] = None
    totalHardisk: Optional[Union[int, str]] = None
    totalCpu: Optional[Union[int, str]] = None
    availableRam: Optional[Union[int, str]] = None
    availableHardisk: Optional[Union[Union[int, str]]] = None
    availableCpu: Optional[Union[int, str]] = None
    remarks: Optional[str] = None
    type: Optional[str] = "Node"
    isPhysical: Optional[bool] = False
    os: Optional[str] = None
    createdBy: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateNodeDetailsModel(BaseModel):
    nodeId: Optional[str] = None
    clusterId: str
    slNumber: Optional[str] = None
    rack: str
    hostName: str
    ipAddress: str
    serverModel: str
    serialNumber: str
    admin: Optional[Union[str, List[str]]] = None
    adminCode: str
    hypervisor: str
    applications: str
    clusterType: str
    indentor: str
    poNum: str
    assetNum: str
    custodian: str
    redundancyPower: str
    totalRam: Optional[Union[int, str]] = None
    totalHardisk: Optional[Union[int, str]] = None
    totalCpu: Optional[Union[int, str]] = None
    remarks: Optional[str] = None
    type: Optional[str] = "Node"
    isPhysical: Optional[bool] = False
    os: Optional[str] = None

class UpdateNodeDetailsModel(BaseModel):
    nodeId: Optional[str] = None
    slNumber: Optional[str] = None
    rack: Optional[str] = None
    hostName: Optional[str] = None
    ipAddress: Optional[str] = None
    serverModel: Optional[str] = None
    serialNumber: Optional[str] = None
    admin: Optional[Union[str, List[str]]] = None
    adminCode: Optional[str] = None
    hypervisor: Optional[str] = None
    applications: Optional[str] = None
    clusterType: Optional[str] = None
    indentor: Optional[str] = None
    poNum: Optional[str] = None
    assetNum: Optional[str] = None
    custodian: Optional[str] = None
    redundancyPower: Optional[str] = None
    totalRam: Optional[Union[int, str]] = None
    totalHardisk: Optional[Union[int, str]] = None
    totalCpu: Optional[Union[int, str]] = None
    remarks: Optional[str] = None
    type: Optional[str] = None
    isPhysical: Optional[bool] = None
    os: Optional[str] = None
    
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedNodeDetailsModel(BaseModel):
    data: List[NodeDetailsModel]
    total: int

class ClusterModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    slNumber: Optional[str] = None
    clusterName: Optional[str] = None
    ipAddress: Optional[str] = None
    racks: List[str] = Field(default_factory=list)
    clusterType: Optional[str] = None
    nodes: List[str] = Field(default_factory=list)
    nodeNames: List[str] = Field(default_factory=list)
    networkType: Optional[str] = "intranet"
    remarks: Optional[str] = None
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedBy: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateClusterModel(BaseModel):
    clusterName: Optional[str] = None
    ipAddress: Optional[str] = None
    racks: Optional[List[str]] = Field(default_factory=list)
    clusterType: Optional[str] = None
    nodes: Optional[List[str]] = Field(default_factory=list)
    networkType: Optional[str] = "intranet"
    remarks: Optional[str] = None

class UpdateClusterModel(BaseModel):
    clusterName: Optional[str] = None
    ipAddress: Optional[str] = None
    racks: Optional[List[str]] = None
    clusterType: Optional[str] = None
    nodes: Optional[List[str]] = None
    networkType: Optional[str] = None
    remarks: Optional[str] = None
    
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedClustersModel(BaseModel):
    data: List[ClusterModel]
    total: int

class ADDetailsModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    clusterId: str
    ipAddress: str
    name: str
    hdd: str
    ram: str
    cpuCores: str
    osVersion: str
    osType: str
    licenceExpiry: str
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateADDetailsModel(BaseModel):
    clusterId: str
    ipAddress: str
    name: str
    hdd: str
    ram: str
    cpuCores: str
    osVersion: str
    osType: str
    licenceExpiry: str

class UpdateADDetailsModel(BaseModel):
    ipAddress: Optional[str] = None
    name: Optional[str] = None
    hdd: Optional[str] = None
    ram: Optional[str] = None
    cpuCores: Optional[str] = None
    osVersion: Optional[str] = None
    osType: Optional[str] = None
    licenceExpiry: Optional[str] = None

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedADDetailsModel(BaseModel):
    data: List[ADDetailsModel]
    total: int

class VCenterDetailsModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    clusterId: str
    ipAddress: str
    name: str
    hdd: str
    ram: str
    cpuCores: str
    vcenterVersion: str
    vcenterType: str
    licenceExpiry: str
    ha: str
    drs: str
    storage: str
    portGroups: str
    vmImageBackupLocation: str
    username: Optional[str] = None
    password: Optional[str] = None
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateVCenterDetailsModel(BaseModel):
    clusterId: str
    ipAddress: str
    name: str
    hdd: Optional[str] = None
    ram: Optional[str] = None
    cpuCores: Optional[str] = None
    vcenterVersion: Optional[str] = None
    vcenterType: Optional[str] = None
    licenceExpiry: Optional[str] = None
    ha: Optional[str] = None
    drs: Optional[str] = None
    storage: Optional[str] = None
    portGroups: Optional[str] = None
    vmImageBackupLocation: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None

class UpdateVCenterDetailsModel(BaseModel):
    ipAddress: Optional[str] = None
    name: Optional[str] = None
    hdd: Optional[str] = None
    ram: Optional[str] = None
    cpuCores: Optional[str] = None
    vcenterVersion: Optional[str] = None
    vcenterType: Optional[str] = None
    licenceExpiry: Optional[str] = None
    ha: Optional[str] = None
    drs: Optional[str] = None
    storage: Optional[str] = None
    portGroups: Optional[str] = None
    vmImageBackupLocation: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedVCenterDetailsModel(BaseModel):
    data: List[VCenterDetailsModel]
    total: int

class VMDetailsModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    vmId: Optional[str] = None
    vmName: Optional[str] = None
    clusterId: Optional[str] = None
    ipAddress: Optional[str] = None
    applications: Optional[str] = None
    node: Optional[str] = None
    osAndExpiry: Optional[str] = None
    hdd: Optional[str] = None
    ram: Optional[str] = None
    cpu: Optional[str] = None
    backupName: Optional[str] = ""
    backupNode: Optional[str] = ""
    backupStorage: Optional[str] = ""
    datastore: Optional[str] = ""
    addedToMonitoring: Optional[bool] = False
    adminName: Optional[str] = None
    adminContact: Optional[str] = None
    admin: Optional[Union[str, List[str]]] = None
    powerStatus: Optional[str] = None
    isNetworkConnected: Optional[bool] = True
    networkType: Optional[str] = None
    clones: Optional[List[dict]] = Field(default_factory=list)
    snapshots: Optional[List[dict]] = Field(default_factory=list)
    templates: Optional[List[dict]] = Field(default_factory=list)
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedBy: Optional[str] = None
    updatedAt: Optional[str] = None
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateVMDetailsModel(BaseModel):
    vmId: Optional[str] = None
    vmName: Optional[str] = None
    clusterId: Optional[str] = None
    ipAddress: Optional[str] = None
    applications: Optional[str] = None
    node: Optional[str] = None
    osAndExpiry: Optional[str] = None
    hdd: Optional[str] = None
    ram: Optional[str] = None
    cpu: Optional[str] = None
    backupName: Optional[str] = ""
    backupNode: Optional[str] = ""
    backupStorage: Optional[str] = ""
    datastore: Optional[str] = ""
    addedToMonitoring: Optional[bool] = False
    adminName: Optional[str] = None
    adminContact: Optional[str] = None
    admin: Optional[Union[str, List[str]]] = None
    powerStatus: Optional[str] = None
    isNetworkConnected: Optional[bool] = True
    networkType: Optional[str] = None
    clones: Optional[List[dict]] = Field(default_factory=list)
    snapshots: Optional[List[dict]] = Field(default_factory=list)
    templates: Optional[List[dict]] = Field(default_factory=list)

class UpdateVMDetailsModel(BaseModel):
    vmId: Optional[str] = None
    vmName: Optional[str] = None
    clusterId: Optional[str] = None
    ipAddress: Optional[str] = None
    applications: Optional[str] = None
    node: Optional[str] = None
    osAndExpiry: Optional[str] = None
    hdd: Optional[str] = None
    ram: Optional[str] = None
    cpu: Optional[str] = None
    backupName: Optional[str] = None
    backupNode: Optional[str] = None
    backupStorage: Optional[str] = None
    datastore: Optional[str] = None
    addedToMonitoring: Optional[bool] = None
    adminName: Optional[str] = None
    adminContact: Optional[str] = None
    admin: Optional[Union[str, List[str]]] = None
    powerStatus: Optional[str] = None
    isNetworkConnected: Optional[bool] = None
    networkType: Optional[str] = None
    clones: Optional[List[dict]] = None
    snapshots: Optional[List[dict]] = None
    templates: Optional[List[dict]] = None

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedVMDetailsModel(BaseModel):
    data: List[VMDetailsModel]
    total: int
class CreateRequestModel(BaseModel):
    requestType: str = Field(..., description="VM Creation, VM Management, DC Entry, Hardware Issuance, Hardware Replacement")
    description: Optional[str] = None
    purpose: Optional[str] = None
    details: Optional[dict] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class UpdateRequestModel(BaseModel):
    requestType: Optional[str] = None
    description: Optional[str] = None
    purpose: Optional[str] = None
    details: Optional[dict] = None
    status: Optional[str] = None
    remarks: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class RequestModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    requestId: Optional[str] = None
    requestType: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    details: Optional[dict] = None
    status: str = "Pending"
    remarks: Optional[str] = None
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

    # Legacy fields from old schema
    name: Optional[str] = None
    division: Optional[str] = None
    purpose: Optional[str] = None
    ram: Optional[str] = None
    hardDisk: Optional[str] = None
    cpu: Optional[str] = None
    ip: Optional[str] = None
    vmUsername: Optional[str] = None
    vmPassword: Optional[str] = None
    vmType: Optional[str] = None
    osVersion: Optional[str] = None
    dateAndTime: Optional[str] = None
    hardwareNeeded: Optional[str] = None
    quantity: Optional[int] = None
    departmentHead: Optional[str] = None
    targetApprover: Optional[str] = None
    currentStageIndex: Optional[int] = None
    currentAssignedUsers: Optional[list] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        extra="allow",
    )

class PaginatedRequestsModel(BaseModel):
    data: List[RequestModel]
    total: int

# --- Request Routing Configuration ---

class ConditionalAssignmentRule(BaseModel):
    conditionField: str = "networkType"
    conditionValue: str = "Internet"
    assignmentType: Optional[str] = None
    assignedTo: Optional[Union[str, List[str]]] = None

    model_config = ConfigDict(
        extra="allow",
    )

class RequestRoutingStage(BaseModel):
    stageName: str
    order: int = 0
    assignmentType: Optional[str] = None
    assignedTo: Optional[Union[str, List[str]]] = None  # username(s) of assigned user(s)
    conditionField: Optional[str] = None
    conditionOperator: Optional[str] = "equals"
    conditionValue: Optional[str] = None
    conditionalAssignments: Optional[List[ConditionalAssignmentRule]] = []

    model_config = ConfigDict(
        extra="allow",
    )

class CreateRequestRoutingStage(RequestRoutingStage):
    @field_validator('stageName')
    @classmethod
    def validate_stage_name(cls, v):
        import re
        if v:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Stage name cannot be empty")
            if not re.match(r"^[a-zA-Z\s]+$", v_trimmed):
                raise ValueError("Stage name must contain alphabets and spaces only")
            if len(v_trimmed) > 20:
                raise ValueError("Stage name must be maximum 20 characters")
            return v_trimmed
        return v

class CreateRequestRoutingModel(BaseModel):
    requestType: str
    stages: List[CreateRequestRoutingStage] = []

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class UpdateRequestRoutingModel(BaseModel):
    requestType: Optional[str] = None
    stages: Optional[List[CreateRequestRoutingStage]] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class RequestRoutingModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    requestType: str
    stages: List[RequestRoutingStage] = []

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class PaginatedRequestRoutingsModel(BaseModel):
    data: List[RequestRoutingModel]
    total: int

class AttendanceModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    username: str
    fullName: Optional[str] = None
    department: str
    date: str  # YYYY-MM-DD
    firstLogin: Optional[str] = None  # ISO format string
    lastLogout: Optional[str] = None  # ISO format string
    workedHours: float = 0.0
    regularizeStatus: str = "None"  # "None", "Pending", "Approved", "Rejected"
    regularizeReason: Optional[str] = None
    regularizeRemarks: Optional[str] = None
    shiftName: Optional[str] = None
    shiftStart: Optional[str] = None
    shiftEnd: Optional[str] = None
    lateApprovalStatus: Optional[str] = None
    isLateAttempt: Optional[bool] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateAttendanceModel(BaseModel):
    username: str
    department: str
    date: str
    firstLogin: Optional[str] = None
    lastLogout: Optional[str] = None
    workedHours: float = 0.0
    regularizeStatus: str = "None"
    regularizeReason: Optional[str] = None
    regularizeRemarks: Optional[str] = None

class UpdateAttendanceModel(BaseModel):
    firstLogin: Optional[str] = None
    lastLogout: Optional[str] = None
    workedHours: Optional[float] = None
    regularizeStatus: Optional[str] = None
    regularizeReason: Optional[str] = None
    regularizeRemarks: Optional[str] = None

class PaginatedAttendanceModel(BaseModel):
    data: List[AttendanceModel]
    total: int

class ShiftInfoModel(BaseModel):
    name: str
    startTime: str  # "HH:MM"
    endTime: str    # "HH:MM"

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        import re
        if v:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Shift name cannot be empty")
            if not re.match(r"^[a-zA-Z0-9\s]+$", v_trimmed):
                raise ValueError("Shift name must contain alphanumeric characters and spaces only")
            if len(v_trimmed) > 50:
                raise ValueError("Shift name must be maximum 50 characters")
            return v_trimmed
        return v

class RosterRowModel(BaseModel):
    name: str
    mappedShift: str

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        import re
        if v:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Roster row name cannot be empty")
            if not re.match(r"^[a-zA-Z0-9\s]+$", v_trimmed):
                raise ValueError("Roster row name must contain alphanumeric characters and spaces only")
            if len(v_trimmed) > 50:
                raise ValueError("Roster row name must be maximum 50 characters")
            return v_trimmed
        return v

class RosterValidationRuleModel(BaseModel):
    id: Optional[str] = None
    fromShift: str
    allowedNextShifts: List[str] = Field(default_factory=list)
    restrictedNextShifts: List[str] = Field(default_factory=list)
    description: Optional[str] = None

class AttendanceConfigModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    startDay: int = 1
    endDay: int = 31
    shiftStart: str = "09:00"
    lateGracePeriod: int = 30
    maxAllowedDays: int = 26
    shifts: List[ShiftInfoModel] = Field(default_factory=list)
    trackedRole: Optional[str] = "All Roles"
    rosterRows: List[RosterRowModel] = Field(default_factory=list)
    validationRules: List[RosterValidationRuleModel] = Field(default_factory=list)
    lateLoginRestriction: bool = True

    @field_validator('shifts')
    @classmethod
    def validate_shifts_count(cls, v):
        if not v or len(v) < 4:
            raise ValueError("At least 4 shifts must be configured")
        return v

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class PhysicalServerModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    clusterId: Optional[str] = None
    ipAddress: Optional[str] = None
    applications: Optional[str] = None
    node: Optional[str] = None
    osAndExpiry: Optional[str] = None
    hdd: Optional[str] = None
    ram: Optional[str] = None
    cpu: Optional[str] = None
    backupLocation: Optional[str] = ""
    addedToMonitoring: Optional[bool] = False
    admin: Optional[Union[str, List[str]]] = None
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedBy: Optional[str] = None
    updatedAt: Optional[str] = None
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreatePhysicalServerModel(BaseModel):
    clusterId: Optional[str] = None
    ipAddress: Optional[str] = None
    applications: Optional[str] = None
    node: Optional[str] = None
    osAndExpiry: Optional[str] = None
    hdd: Optional[str] = None
    ram: Optional[str] = None
    cpu: Optional[str] = None
    backupLocation: Optional[str] = ""
    addedToMonitoring: Optional[bool] = False
    admin: Optional[Union[str, List[str]]] = None

class UpdatePhysicalServerModel(BaseModel):
    clusterId: Optional[str] = None
    ipAddress: Optional[str] = None
    applications: Optional[str] = None
    node: Optional[str] = None
    osAndExpiry: Optional[str] = None
    hdd: Optional[str] = None
    ram: Optional[str] = None
    cpu: Optional[str] = None
    backupLocation: Optional[str] = None
    addedToMonitoring: Optional[bool] = None
    admin: Optional[Union[str, List[str]]] = None

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedPhysicalServersModel(BaseModel):
    data: List[PhysicalServerModel]
    total: int

class DatastoreModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str = Field(...)
    type: Optional[str] = None
    capacity: Optional[str] = None
    node: Optional[str] = None
    mountPath: Optional[str] = None
    remarks: Optional[str] = None
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedBy: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateDatastoreModel(BaseModel):
    name: str = Field(...)
    type: Optional[str] = None
    capacity: Optional[str] = None
    node: Optional[str] = None
    mountPath: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        import re
        if v:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Name cannot be empty")
            if not re.match(r"^[a-zA-Z0-9\s,.-_]+$", v_trimmed):
                raise ValueError("Name must contain alphanumeric characters, spaces, commas, periods, dashes, or underscores only")
            if len(v_trimmed) > 50:
                raise ValueError("Name must be maximum 50 characters")
            return v_trimmed
        return v

    @field_validator('capacity')
    @classmethod
    def validate_capacity(cls, v):
        import re
        if v is not None:
            v_trimmed = v.strip()
            if v_trimmed:
                if not re.match(r"^[a-zA-Z0-9\s]+$", v_trimmed):
                    raise ValueError("Capacity must contain alphanumeric characters and spaces only")
                if len(v_trimmed) > 20:
                    raise ValueError("Capacity must be maximum 20 characters")
            return v_trimmed
        return v

    @field_validator('mountPath')
    @classmethod
    def validate_mount_path(cls, v):
        import re
        if v is not None:
            v_trimmed = v.strip()
            if v_trimmed:
                if not re.match(r"^[a-zA-Z0-9\s,.-_/]+$", v_trimmed):
                    raise ValueError("Mount Path must contain alphanumeric characters, spaces, slashes, periods, dashes, or underscores only")
                if len(v_trimmed) > 100:
                    raise ValueError("Mount Path must be maximum 100 characters")
            return v_trimmed
        return v

    @field_validator('remarks')
    @classmethod
    def validate_remarks(cls, v):
        import re
        if v is not None:
            v_trimmed = v.strip()
            if v_trimmed:
                if not re.match(r"^[a-zA-Z0-9\s,.-]+$", v_trimmed):
                    raise ValueError("Remarks must contain alphanumeric characters, spaces, commas, periods, or dashes only")
                if len(v_trimmed) > 125:
                    raise ValueError("Remarks must be maximum 125 characters")
            return v_trimmed
        return v

class UpdateDatastoreModel(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    capacity: Optional[str] = None
    node: Optional[str] = None
    mountPath: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        import re
        if v is not None:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Name cannot be empty")
            if not re.match(r"^[a-zA-Z0-9\s,.-_]+$", v_trimmed):
                raise ValueError("Name must contain alphanumeric characters, spaces, commas, periods, dashes, or underscores only")
            if len(v_trimmed) > 50:
                raise ValueError("Name must be maximum 50 characters")
            return v_trimmed
        return v

    @field_validator('capacity')
    @classmethod
    def validate_capacity(cls, v):
        import re
        if v is not None:
            v_trimmed = v.strip()
            if v_trimmed:
                if not re.match(r"^[a-zA-Z0-9\s]+$", v_trimmed):
                    raise ValueError("Capacity must contain alphanumeric characters and spaces only")
                if len(v_trimmed) > 20:
                    raise ValueError("Capacity must be maximum 20 characters")
            return v_trimmed
        return v

    @field_validator('mountPath')
    @classmethod
    def validate_mount_path(cls, v):
        import re
        if v is not None:
            v_trimmed = v.strip()
            if v_trimmed:
                if not re.match(r"^[a-zA-Z0-9\s,.-_/]+$", v_trimmed):
                    raise ValueError("Mount Path must contain alphanumeric characters, spaces, slashes, periods, dashes, or underscores only")
                if len(v_trimmed) > 100:
                    raise ValueError("Mount Path must be maximum 100 characters")
            return v_trimmed
        return v

    @field_validator('remarks')
    @classmethod
    def validate_remarks(cls, v):
        import re
        if v is not None:
            v_trimmed = v.strip()
            if v_trimmed:
                if not re.match(r"^[a-zA-Z0-9\s,.-]+$", v_trimmed):
                    raise ValueError("Remarks must contain alphanumeric characters, spaces, commas, periods, or dashes only")
                if len(v_trimmed) > 125:
                    raise ValueError("Remarks must be maximum 125 characters")
            return v_trimmed
        return v

class PaginatedDatastoresModel(BaseModel):
    data: List[DatastoreModel]
    total: int

class RoleRosterMappingModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    roleId: str
    roleName: str
    departmentId: str
    departmentName: str

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateRoleRosterMappingModel(BaseModel):
    roleId: str
    roleName: str
    departmentId: str
    departmentName: str
