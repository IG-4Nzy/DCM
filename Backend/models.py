from pydantic import BaseModel, ConfigDict, Field, field_validator
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

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

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
    dueDate: str = ""
    description: str = ""
    attachments: List[dict] = Field(default_factory=list)
    status: str = "Pending"
    comments: List[dict] = Field(default_factory=list)
    completedAt: Optional[str] = None

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
    dueDate: str = ""
    description: str = ""
    attachments: List[dict] = Field(default_factory=list)
    status: str = "Pending"
    comments: List[dict] = Field(default_factory=list)
    completedAt: Optional[str] = None

class UpdateWorkModel(BaseModel):
    workName: Optional[str] = None
    assignee: Optional[str] = None
    priority: Optional[str] = None
    dueDate: Optional[str] = None
    description: Optional[str] = None
    attachments: Optional[List[dict]] = None
    status: Optional[str] = None
    comments: Optional[List[dict]] = None
    completedAt: Optional[str] = None

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

class UpdateObservationModel(BaseModel):
    observedDate: Optional[str] = None
    observedTime: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    amc: Optional[str] = None
    informedTo: Optional[Union[str, List[str]]] = None
    informedToOther: Optional[str] = None
    status: Optional[str] = None

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

class InventoryModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    itemName: str
    quantity: int
    description: Optional[str] = None
    department: Optional[str] = None
    lastUpdatedDate: str
    lastUpdatedBy: str
    history: List[InventoryHistoryModel] = []

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateInventoryModel(BaseModel):
    itemName: str
    quantity: int
    description: Optional[str] = None
    date: str

class UpdateInventoryModel(BaseModel):
    quantityChange: int
    action: str
    givenTo: Optional[str] = None
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

class UpdateClusterTypeModel(BaseModel):
    clusterType: Optional[str] = None
    remarks: Optional[str] = None
    
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

class UpdateHypervisorModel(BaseModel):
    hypervisor: Optional[str] = None
    remarks: Optional[str] = None
    
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedHypervisorsModel(BaseModel):
    data: List[HypervisorModel]
    total: int

class NodeModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    node: str
    remarks: Optional[str] = None
    totalRam: Optional[int] = None
    totalHardisk: Optional[int] = None
    totalCpu: Optional[int] = None
    availableRam: Optional[int] = None
    availableHardisk: Optional[int] = None
    availableCpu: Optional[int] = None
    createdBy: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateNodeModel(BaseModel):
    node: str
    remarks: Optional[str] = None
    totalRam: Optional[int] = None
    totalHardisk: Optional[int] = None
    totalCpu: Optional[int] = None

class UpdateNodeModel(BaseModel):
    node: Optional[str] = None
    remarks: Optional[str] = None
    totalRam: Optional[int] = None
    totalHardisk: Optional[int] = None
    totalCpu: Optional[int] = None
    
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedNodesModel(BaseModel):
    data: List[NodeModel]
    total: int

class ServerRackModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    serverRack: str
    remarks: Optional[str] = None
    createdBy: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateServerRackModel(BaseModel):
    serverRack: str
    remarks: Optional[str] = None

class UpdateServerRackModel(BaseModel):
    serverRack: Optional[str] = None
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
    clusterId: str
    slNumber: str
    rack: str
    hostName: str
    ipAddress: str
    serverModel: str
    serialNumber: str
    admin: str
    adminCode: str
    hypervisor: str
    applications: str
    clusterType: str
    indentor: str
    poNum: str
    assetNum: str
    custodian: str
    redundancyPower: str
    totalRam: Optional[int] = None
    totalHardisk: Optional[int] = None
    totalCpu: Optional[int] = None
    availableRam: Optional[int] = None
    availableHardisk: Optional[int] = None
    availableCpu: Optional[int] = None
    remarks: Optional[str] = None
    createdBy: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateNodeDetailsModel(BaseModel):
    clusterId: str
    slNumber: Optional[str] = None
    rack: str
    hostName: str
    ipAddress: str
    serverModel: str
    serialNumber: str
    admin: str
    adminCode: str
    hypervisor: str
    applications: str
    clusterType: str
    indentor: str
    poNum: str
    assetNum: str
    custodian: str
    redundancyPower: str
    totalRam: Optional[int] = None
    totalHardisk: Optional[int] = None
    totalCpu: Optional[int] = None
    remarks: Optional[str] = None

class UpdateNodeDetailsModel(BaseModel):
    slNumber: Optional[str] = None
    rack: Optional[str] = None
    hostName: Optional[str] = None
    ipAddress: Optional[str] = None
    serverModel: Optional[str] = None
    serialNumber: Optional[str] = None
    admin: Optional[str] = None
    adminCode: Optional[str] = None
    hypervisor: Optional[str] = None
    applications: Optional[str] = None
    clusterType: Optional[str] = None
    indentor: Optional[str] = None
    poNum: Optional[str] = None
    assetNum: Optional[str] = None
    custodian: Optional[str] = None
    redundancyPower: Optional[str] = None
    totalRam: Optional[int] = None
    totalHardisk: Optional[int] = None
    totalCpu: Optional[int] = None
    remarks: Optional[str] = None
    
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedNodeDetailsModel(BaseModel):
    data: List[NodeDetailsModel]
    total: int

class ClusterModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    slNumber: Optional[str] = None
    clusterName: str
    ipAddress: str

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateClusterModel(BaseModel):
    clusterName: str
    ipAddress: str

class UpdateClusterModel(BaseModel):
    clusterName: Optional[str] = None
    ipAddress: Optional[str] = None
    
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
    clusterId: str
    ipAddress: str
    applications: str
    node: str
    osAndExpiry: str
    hdd: str
    ram: str
    cpu: str
    backupLocation: Optional[str] = ""
    addedToMonitoring: Optional[bool] = False
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreateVMDetailsModel(BaseModel):
    clusterId: str
    ipAddress: str
    applications: str
    node: str
    osAndExpiry: str
    hdd: str
    ram: str
    cpu: str
    backupLocation: Optional[str] = ""
    addedToMonitoring: Optional[bool] = False

class UpdateVMDetailsModel(BaseModel):
    ipAddress: Optional[str] = None
    applications: Optional[str] = None
    node: Optional[str] = None
    osAndExpiry: Optional[str] = None
    hdd: Optional[str] = None
    ram: Optional[str] = None
    cpu: Optional[str] = None
    backupLocation: Optional[str] = None
    addedToMonitoring: Optional[bool] = None

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

class PaginatedVMDetailsModel(BaseModel):
    data: List[VMDetailsModel]
    total: int
class CreateRequestModel(BaseModel):
    requestType: str = Field(..., description="VM Creation, DC Entry, Hardware Issuance, Hardware Replacement")
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

class RequestRoutingStage(BaseModel):
    stageName: str
    order: int = 0
    assignmentType: Optional[str] = None
    assignedTo: Optional[str] = None  # username of assigned user

    model_config = ConfigDict(
        extra="allow",
    )

class CreateRequestRoutingModel(BaseModel):
    requestType: str
    stages: List[RequestRoutingStage] = []

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class UpdateRequestRoutingModel(BaseModel):
    requestType: Optional[str] = None
    stages: Optional[List[RequestRoutingStage]] = None

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

class RosterRowModel(BaseModel):
    name: str
    mappedShift: str

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

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


