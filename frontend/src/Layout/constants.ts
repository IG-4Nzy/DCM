import { Icons } from "../helpers/icons";
import { PRIVILEGES } from "../helpers/privileges";
import wordings from "../helpers/wordings";
import { ROUTE_CONSTANTS } from "../router/constant";

export const SIDEBAR_OPTIONS = [
    {
        label: wordings.dashboard,
        icon: Icons.DashboardIcon,
        route: ROUTE_CONSTANTS.DASHBOARD,
        privileges: [PRIVILEGES.DASHBOARD_VIEW]
    },
    {
        label: wordings.users,
        icon: Icons.UsersIcon,
        route: ROUTE_CONSTANTS.USERS,
        privileges: [PRIVILEGES.USER_VIEW_ALL, PRIVILEGES.USER_VIEW_DEPT, PRIVILEGES.USER_CREATE, PRIVILEGES.USER_UPDATE, PRIVILEGES.USER_DELETE]
    },
    {
        label: wordings.roles,
        icon: Icons.RolesIcon,
        route: ROUTE_CONSTANTS.ROLES,
        privileges: [PRIVILEGES.ROLE_VIEW, PRIVILEGES.ROLE_CREATE, PRIVILEGES.ROLE_UPDATE, PRIVILEGES.ROLE_DELETE]
    },
    {
        label: wordings.works,
        icon: Icons.WorksIcon,
        route: ROUTE_CONSTANTS.WORKS,
        privileges: [PRIVILEGES.WORK_VIEW, PRIVILEGES.WORK_VIEW_ASSIGNED, PRIVILEGES.WORK_CREATE, PRIVILEGES.WORK_UPDATE, PRIVILEGES.WORK_DELETE]
    },
    {
        label: wordings.departments,
        icon: Icons.DepartmentIcon,
        route: ROUTE_CONSTANTS.DEPARTMENTS,
        privileges: [PRIVILEGES.DEPARTMENT_VIEW, PRIVILEGES.DEPARTMENT_CREATE, PRIVILEGES.DEPARTMENT_UPDATE, PRIVILEGES.DEPARTMENT_DELETE]
    },
    {
        label: wordings.roaster,
        icon: Icons.RoasterIcon,
        route: ROUTE_CONSTANTS.ROASTER,
        privileges: [PRIVILEGES.ROASTER_VIEW, PRIVILEGES.ROASTER_CREATE, PRIVILEGES.ROASTER_UPDATE, PRIVILEGES.ROASTER_DELETE]
    },
    {
        label: wordings.observations,
        icon: Icons.EyeIcon,
        route: ROUTE_CONSTANTS.OBSERVATIONS,
        privileges: [PRIVILEGES.OBSERVATION_VIEW, PRIVILEGES.OBSERVATION_CREATE, PRIVILEGES.OBSERVATION_UPDATE, PRIVILEGES.OBSERVATION_DELETE]
    },
    {
        label: wordings.inventory,
        icon: Icons.InventoryIcon,
        route: ROUTE_CONSTANTS.INVENTORY,
        privileges: [PRIVILEGES.INVENTORY_VIEW_ALL, PRIVILEGES.INVENTORY_VIEW_DEPT, PRIVILEGES.INVENTORY_CREATE, PRIVILEGES.INVENTORY_UPDATE, PRIVILEGES.INVENTORY_DELETE]
    },
    {
        label: wordings.configurations,
        icon: Icons.ConfigurationsIcon,
        route: ROUTE_CONSTANTS.CONFIGURATIONS,
        privileges: [PRIVILEGES.CONFIGURATION_VIEW, PRIVILEGES.CONFIGURATION_CREATE, PRIVILEGES.CONFIGURATION_UPDATE, PRIVILEGES.CONFIGURATION_DELETE]
    },

    {
        label: wordings.clusters,
        icon: Icons.ClusterIcon,
        route: ROUTE_CONSTANTS.CLUSTER,
        privileges: [PRIVILEGES.CLUSTER_VIEW, PRIVILEGES.CLUSTER_CREATE, PRIVILEGES.CLUSTER_UPDATE, PRIVILEGES.CLUSTER_DELETE]
    },
    {
        label: wordings.requests,
        icon: Icons.RequestsIcon,
        route: ROUTE_CONSTANTS.REQUESTS,
        privileges: [PRIVILEGES.REQUEST_VIEW, PRIVILEGES.REQUEST_CREATE, PRIVILEGES.REQUEST_UPDATE, PRIVILEGES.REQUEST_DELETE]
    },
    {
        label: wordings.search,
        icon: Icons.SearchIcon,
        route: ROUTE_CONSTANTS.SEARCH,
        privileges: [PRIVILEGES.SEARCH_VIEW]
    },
    {
        label: wordings.serverMonitoring,
        icon: Icons.BellIcon,
        route: ROUTE_CONSTANTS.SERVER_MONITORING,
        privileges: [PRIVILEGES.SERVER_MONITORING_VIEW, PRIVILEGES.SERVER_MONITORING_CREATE, PRIVILEGES.SERVER_MONITORING_UPDATE, PRIVILEGES.SERVER_MONITORING_DELETE]
    },
    {
        label: wordings.attendance,
        icon: Icons.AttendanceIcon,
        route: ROUTE_CONSTANTS.ATTENDANCE,
        privileges: [PRIVILEGES.VIEW_DEPARTMENTAL_ATTENDACE,PRIVILEGES.VIEW_SELF_ATTENDANCE,PRIVILEGES.VIEW_ALL_ATTENDACE ,PRIVILEGES.ATTENDANCE_CREATE, PRIVILEGES.ATTENDANCE_UPDATE, PRIVILEGES.ATTENDANCE_DELETE]
    },
    {
        label: wordings.documentations,
        icon: Icons.DocumentationsIcon,
        route: ROUTE_CONSTANTS.DOCUMENTATIONS,
        privileges: [PRIVILEGES.DOCUMENTATION_VIEW]
    },
    {
        label: wordings.auditLogs,
        icon: Icons.TerminalIcon,
        route: ROUTE_CONSTANTS.AUDIT_LOGS,
        superuserOnly: true
    },
    {
        label: wordings.bmsChecklist,
        icon: Icons.BMSChecklistIcon,
        route: ROUTE_CONSTANTS.BMS_CHECKLIST,
        privileges: [PRIVILEGES.BMS_CHECKLIST_VIEW, PRIVILEGES.BMS_CHECKLIST_CREATE, PRIVILEGES.BMS_CHECKLIST_UPDATE, PRIVILEGES.BMS_CHECKLIST_DELETE]
    },
    {
        label: wordings.visitorLogs,
        icon: Icons.VisitorLogsIcon,
        route: ROUTE_CONSTANTS.VISITOR_LOGS,
        privileges: [PRIVILEGES.REQUEST_VIEW]
    }
]