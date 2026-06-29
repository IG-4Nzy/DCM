// @ts-nocheck
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
        privileges: [PRIVILEGES.WORK_VIEW, PRIVILEGES.WORK_VIEW_ASSIGNED, PRIVILEGES.WORK_CREATE, PRIVILEGES.WORK_UPDATE, PRIVILEGES.WORK_DELETE, PRIVILEGES.EMERGENCY_WORK_VIEW]
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
        privileges: [PRIVILEGES.OBSERVATION_VIEW, PRIVILEGES.OBSERVATION_VIEW_ALL_DEPT, PRIVILEGES.OBSERVATION_CREATE, PRIVILEGES.OBSERVATION_UPDATE, PRIVILEGES.OBSERVATION_DELETE]
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
        label: wordings.serverDetails,
        icon: Icons.ServerDetailsIcon,
        route: ROUTE_CONSTANTS.SERVER_DETAILS,
        privileges: [
            PRIVILEGES.SERVER_DETAILS_CREATE
        ]
    },
    {
        label: wordings.requests,
        icon: Icons.RequestsIcon,
        route: ROUTE_CONSTANTS.REQUESTS,
        privileges: [PRIVILEGES.REQUEST_VIEW, PRIVILEGES.REQUEST_CREATE, PRIVILEGES.REQUEST_UPDATE, PRIVILEGES.REQUEST_DELETE, PRIVILEGES.REQUEST_TYPE_VIEW, PRIVILEGES.REQUEST_TYPE_CREATE, PRIVILEGES.REQUEST_TYPE_UPDATE, PRIVILEGES.REQUEST_TYPE_DELETE]
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
        label: wordings.serverPingMonitoring,
        icon: Icons.BellIcon,
        route: ROUTE_CONSTANTS.SERVER_PING_MONITORING,
        privileges: [PRIVILEGES.SERVER_PING_MONITORING_VIEW, PRIVILEGES.SERVER_PING_MONITORING_CREATE, PRIVILEGES.SERVER_PING_MONITORING_UPDATE, PRIVILEGES.SERVER_PING_MONITORING_DELETE]
    },
    {
        label: wordings.attendance,
        icon: Icons.AttendanceIcon,
        route: ROUTE_CONSTANTS.ATTENDANCE,
        privileges: [PRIVILEGES.VIEW_DEPARTMENTAL_ATTENDACE, PRIVILEGES.VIEW_SELF_ATTENDANCE, PRIVILEGES.VIEW_ALL_ATTENDACE, PRIVILEGES.ATTENDANCE_CREATE, PRIVILEGES.ATTENDANCE_UPDATE, PRIVILEGES.ATTENDANCE_DELETE, PRIVILEGES.ATTENDANCE_VERIFY, PRIVILEGES.VIEW_ATTENDANCE_VERIFICATION]
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
        privileges: [PRIVILEGES.AUDIT_LOGS_VIEW]
    },
    {
        label: wordings.dailyActivities,
        icon: Icons.DailyActivitiesIcon,
        route: ROUTE_CONSTANTS.DAILY_ACTIVITIES,
        privileges: [PRIVILEGES.BMS_CHECKLIST_VIEW, PRIVILEGES.BMS_CHECKLIST_VIEW_ALL_DEPT, PRIVILEGES.BMS_CHECKLIST_CREATE, PRIVILEGES.BMS_CHECKLIST_UPDATE, PRIVILEGES.BMS_CHECKLIST_DELETE, PRIVILEGES.CLUSTER_CHECKLIST_VIEW, PRIVILEGES.CLUSTER_CHECKLIST_VIEW_ALL_DEPT, PRIVILEGES.CLUSTER_CHECKLIST_CREATE, PRIVILEGES.CLUSTER_CHECKLIST_UPDATE, PRIVILEGES.CLUSTER_CHECKLIST_DELETE, PRIVILEGES.MORNING_CHECKLIST_VIEW, PRIVILEGES.MORNING_CHECKLIST_CREATE, PRIVILEGES.MORNING_CHECKLIST_UPDATE, PRIVILEGES.MORNING_CHECKLIST_DELETE]
    },
    {
        label: wordings.visitorLogs,
        icon: Icons.VisitorLogsIcon,
        route: ROUTE_CONSTANTS.VISITOR_LOGS,
        privileges: [PRIVILEGES.VISITOR_LOGS_VIEW, PRIVILEGES.VISITOR_LOGS_CREATE, PRIVILEGES.VISITOR_LOGS_UPDATE, PRIVILEGES.VISITOR_LOGS_DELETE]
    },
    {
        label: wordings.periodicActivities,
        icon: Icons.PeriodicActivitiesIcon,
        route: ROUTE_CONSTANTS.PERIODIC_ACTIVITIES,
        privileges: [PRIVILEGES.PERIODIC_ACTIVITY_VIEW, PRIVILEGES.PERIODIC_ACTIVITY_CREATE, PRIVILEGES.PERIODIC_ACTIVITY_UPDATE, PRIVILEGES.PERIODIC_ACTIVITY_DELETE]
    },
    {
        label: wordings.announcements,
        icon: Icons.AnnouncementsIcon,
        route: ROUTE_CONSTANTS.ANNOUNCEMENTS,
        privileges: [PRIVILEGES.ANNOUNCEMENT_VIEW, PRIVILEGES.ANNOUNCEMENT_CREATE, PRIVILEGES.ANNOUNCEMENT_UPDATE, PRIVILEGES.ANNOUNCEMENT_DELETE]
    },
    // {
    //     label: wordings.notificationTriggering,
    //     icon: Icons.NotificationsActiveIcon,
    //     route: ROUTE_CONSTANTS.NOTIFICATION_TRIGGERING,
    //     privileges: [
    //         PRIVILEGES.NOTIFICATION_TRIGGERING_VIEW,
    //         PRIVILEGES.NOTIFICATION_TRIGGERING_VIEW_DEPT,
    //         PRIVILEGES.NOTIFICATION_TRIGGERING_VIEW_OWN
    //     ]
    // },
    {
        label: wordings.operationLogs,
        icon: Icons.LogsIcon,
        route: ROUTE_CONSTANTS.OPERATION_LOGS,
        privileges: [PRIVILEGES.LOGS_VIEW]
    },
    {
        label: wordings.ipList,
        icon: Icons.IpListIcon,
        route: ROUTE_CONSTANTS.IP_LIST,
        privileges: [PRIVILEGES.IP_LIST_VIEW]
    },
    {
        label: wordings.phoneDirectory,
        icon: Icons.SearchIcon,
        route: ROUTE_CONSTANTS.PHONE_DIRECTORY,
        privileges: [PRIVILEGES.PHONE_DIRECTORY_VIEW]
    }
]