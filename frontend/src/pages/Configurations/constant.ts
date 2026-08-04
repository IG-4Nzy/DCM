// @ts-nocheck
import ClusterTypes from "./ClusterTypes";
import Hypervisors from "./Hypervisors";
import ServerModels from "./ServerModels";
import GPUs from "./GPUs";
import Datastores from "./Datastores";
import RequestRoutings from "./RequestRoutings";
import AttendancePeriodConfig from "./AttendancePeriodConfig";
import BMSChecklistConfig from "./BMSChecklistConfig";
import ClusterChecklistConfig from "./ClusterChecklistConfig";
import MorningChecklistConfig from "./MorningChecklistConfig";
import NotificationSettings from "./NotificationSettings";
import VCenterConfig from "./VCenterConfig";

export const CONFIG_TABS = [
    { id: 'serverMastersConfig', label: 'Server Masters', value: 'serverMastersConfig' },
    { id: 'requestConfig', label: 'Request Configuration', value: 'requestConfig' },
    { id: 'attendanceConfig', label: 'Attendance', value: 'attendanceConfig' },
    { id: 'bmsChecklistConfig', label: 'BMS Checklist', value: 'bmsChecklistConfig' },
    { id: 'clusterChecklistConfig', label: 'Cluster Checklist', value: 'clusterChecklistConfig' },
    { id: 'morningChecklistConfig', label: 'Morning Checklist', value: 'morningChecklistConfig' },
    { id: 'notificationConfig', label: 'Notifications', value: 'notificationConfig' },
];

export const SERVER_MASTERS_CONFIGURATIONS = [
    { id: "clusterTypes", label: "Cluster Types", value: "clusterTypes" },
    { id: "hypervisors", label: "Hypervisors", value: "hypervisors" },
    { id: "serverModel", label: "Server Model", value: "serverModel" },
    { id: "gpus", label: "GPUs", value: "gpus" },
    { id: "datastores", label: "Datastores", value: "datastores" },
    { id: "vcenterConfig", label: "vCenter Refresh", value: "vcenterConfig" },
]

export const REQUEST_CONFIGURATIONS = [
    { id: "requestRoutings", label: "Request Routings", value: "requestRoutings" },
]

export const ATTENDANCE_CONFIGURATIONS = [
    { id: "attendancePeriod", label: "Attendance Period", value: "attendancePeriod" },
]

export const BMS_CHECKLIST_CONFIGURATIONS = [
    { id: "bmsChecklistFields", label: "Checklist Fields", value: "bmsChecklistFields" },
]

export const CLUSTER_CHECKLIST_CONFIGURATIONS = [
    { id: "clusterChecklistFields", label: "Checklist Fields", value: "clusterChecklistFields" },
]

export const MORNING_CHECKLIST_CONFIGURATIONS = [
    { id: "morningChecklistFields", label: "Checklist Fields", value: "morningChecklistFields" },
]

export const NOTIFICATION_CONFIGURATIONS = [
    { id: "notificationSettings", label: "Notification Settings", value: "notificationSettings" },
]

export const CONFIG_SUBTABS = {
    serverMastersConfig: SERVER_MASTERS_CONFIGURATIONS,
    requestConfig: REQUEST_CONFIGURATIONS,
    attendanceConfig: ATTENDANCE_CONFIGURATIONS,
    bmsChecklistConfig: BMS_CHECKLIST_CONFIGURATIONS,
    clusterChecklistConfig: CLUSTER_CHECKLIST_CONFIGURATIONS,
    morningChecklistConfig: MORNING_CHECKLIST_CONFIGURATIONS,
    notificationConfig: NOTIFICATION_CONFIGURATIONS,
}

export const CONFIG_TABS_PAGES = {
    clusterTypes: ClusterTypes,
    hypervisors: Hypervisors,
    serverModel: ServerModels,
    gpus: GPUs,
    datastores: Datastores,
    vcenterConfig: VCenterConfig,
    requestRoutings: RequestRoutings,
    attendancePeriod: AttendancePeriodConfig,
    bmsChecklistFields: BMSChecklistConfig,
    clusterChecklistFields: ClusterChecklistConfig,
    morningChecklistFields: MorningChecklistConfig,
    notificationSettings: NotificationSettings,
}
