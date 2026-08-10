"""
Pydantic schemas for vCenter telemetry data structures.
Kept separate from models.py (which holds MongoDB document schemas) to avoid naming conflicts.
"""
from pydantic import BaseModel, Field
from typing import List, Optional

class MetricSummaryModel(BaseModel):
    cpuUsage: float = Field(..., description="Average CPU utilization percentage")
    ramUsage: float = Field(..., description="Average memory utilization percentage")
    hddUsage: float = Field(..., description="Average storage capacity utilization percentage")
    networkTraffic: float = Field(..., description="Aggregated network throughput in Mbps")

class ESXiHostTelemetry(BaseModel):
    name: str
    ipAddress: str
    status: str
    cpuUsage: float
    ramUsage: float
    cpuTemp: str
    ramTemp: str
    fanSpeed: str
    powerWatts: int

class VMTelemetry(BaseModel):
    name: str
    ipAddress: str
    node: str
    cpuUsage: float
    ramUsage: float
    status: str

class AlarmTelemetry(BaseModel):
    id: str
    severity: str
    message: str
    timestamp: str

class EventTelemetry(BaseModel):
    timestamp: str
    message: str

class VCenterTelemetrySnapshot(BaseModel):
    vcenterId: str
    name: Optional[str] = None
    ipAddress: Optional[str] = None
    status: str = "Green"
    version: str = "8.0.2"
    type: str = "vCenter Server Appliance"
    licenceExpiry: str = "2029-12-31"
    metrics: MetricSummaryModel
    hosts: List[ESXiHostTelemetry] = []
    vms: List[VMTelemetry] = []
    alarms: List[AlarmTelemetry] = []
    events: List[EventTelemetry] = []
    lastUpdated: Optional[str] = None
