import { Icons } from "../helpers/icons";
import wordings from "../helpers/wordings";
import { ROUTE_CONSTANTS } from "../router/constant";

export const SIDEBAR_OPTIONS = [
    {
        label: wordings.dashboard,
        icon: Icons.DashboardIcon,
        route: ROUTE_CONSTANTS.DASHBOARD,
        privileges: ["View Dashboard"]
    },
    {
        label: wordings.users,
        icon: Icons.UsersIcon,
        route: ROUTE_CONSTANTS.USERS,
        privileges: ["View User", "Create User", "Update User", "Delete User"]
    },
    {
        label: wordings.roles,
        icon: Icons.RolesIcon,
        route: ROUTE_CONSTANTS.ROLES,
        privileges: ["View Role", "Create Role", "Update Role", "Delete Role"]
    },
    {
        label: wordings.works,
        icon: Icons.WorksIcon,
        route: ROUTE_CONSTANTS.WORKS,
        privileges: ["View All Work", "View Assigned Work", "Create Work", "Update Work", "Delete Work", "Work Status Update"]
    },
    {
        label: wordings.departments,
        icon: Icons.DepartmentIcon,
        route: ROUTE_CONSTANTS.DEPARTMENTS,
        privileges: ["View Department", "Create Department", "Update Department", "Delete Department"]
    },
    {
        label: wordings.roaster,
        icon: Icons.RoasterIcon,
        route: ROUTE_CONSTANTS.ROASTER,
        privileges: ["View Roaster", "Create Roaster", "Update Roaster", "Delete Roaster"]
    }
]