import { Icons } from "../helpers/icons";
import wordings from "../helpers/wordings";
import { ROUTE_CONSTANTS } from "../router/constant";

export const SIDEBAR_OPTIONS = [
    {
        label: wordings.dashboard,
        icon: Icons.DashboardIcon,
        route: ROUTE_CONSTANTS.DASHBOARD
    },
    {
        label:wordings.users,
        icon: Icons.UsersIcon,
        route: ROUTE_CONSTANTS.USERS
    },
    {
        label:wordings.roles,
        icon: Icons.RolesIcon,
        route: ROUTE_CONSTANTS.ROLES
    }
]