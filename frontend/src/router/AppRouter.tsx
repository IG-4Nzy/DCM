// @ts-nocheck
import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { ROUTE_CONSTANTS } from "./constant";
import Loader from "../components/Loader";
import Layout from "../Layout";

const Login = lazy(() => import("../pages/Auth/Login"));
const Dashboard = lazy(() => import("../pages/Dashboard/Dashboard"));
const PageNotFound = lazy(() => import("../pages/Auth/PageNotFound"));
const Users = lazy(() => import("../pages/Users"));
const Roles = lazy(() => import("../pages/Roles"));
const Works = lazy(() => import("../pages/Work"));
const Departments = lazy(() => import("../pages/Departments"));
const UserProfile = lazy(() => import("../pages/UserProfile"));
const Roaster = lazy(() => import("../pages/Roaster"));
const Observations = lazy(() => import("../pages/Observations"));
const Inventory = lazy(() => import("../pages/Inventory"));
const Configurations = lazy(() => import("../pages/Configurations"));
const ClusterDetails = lazy(() => import("../pages/Clusters/ClusterDetails"));
const Requests = lazy(() => import("../pages/Requests"));
const Search = lazy(() => import("../pages/Search"));
const ServerMonitoring = lazy(() => import("../pages/ServerMonitoring"));
const ServerPingMonitoring = lazy(() => import("../pages/ServerPingMonitoring"));
const Attendance = lazy(() => import("../pages/Attendance"));
const AuditLogs = lazy(() => import("../pages/AuditLogs"));
const Documentations = lazy(() => import("../pages/Documentations"));
const BMSChecklist = lazy(() => import("../pages/BMSChecklist"));
const ClusterChecklist = lazy(() => import("../pages/ClusterChecklist"));
const VisitorLogs = lazy(() => import("../pages/Requests/VisitorLogs"));
const DailyActivities = lazy(() => import("../pages/DailyActivities"));
const PeriodicActivities = lazy(() => import("../pages/PeriodicActivities"));
const Announcements = lazy(() => import("../pages/Announcements"));
const OperationLogs = lazy(() => import("../pages/OperationLogs"));
const IpList = lazy(() => import("../pages/IpList"));
const ServerDetails = lazy(() => import("../pages/ServerDetails"));
const PhoneDirectory = lazy(() => import("../pages/PhoneDirectory"));
const Salary = lazy(() => import("../pages/Salary"));

const AppRouter: React.FC = () => {
  return (
    <Router>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path={ROUTE_CONSTANTS.LOGIN} element={<Login />} />
          <Route path={ROUTE_CONSTANTS.BASE} element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path={ROUTE_CONSTANTS.DASHBOARD} element={<Dashboard />} />
            <Route path={ROUTE_CONSTANTS.USERS} element={<Users />} />
            <Route path={ROUTE_CONSTANTS.ROLES} element={<Roles />} />
            <Route path={ROUTE_CONSTANTS.WORKS} element={<Works />} />
            <Route path={ROUTE_CONSTANTS.DEPARTMENTS} element={<Departments />} />
            <Route path={ROUTE_CONSTANTS.USER_PROFILE} element={<UserProfile />} />
            <Route path={ROUTE_CONSTANTS.ROASTER} element={<Roaster />} />
            <Route path={ROUTE_CONSTANTS.OBSERVATIONS} element={<Observations />} />
            <Route path={ROUTE_CONSTANTS.INVENTORY} element={<Inventory />} />
            <Route path={ROUTE_CONSTANTS.CONFIGURATIONS} element={<Configurations />} />
            <Route path={ROUTE_CONSTANTS.CLUSTER} element={<Navigate to={ROUTE_CONSTANTS.SERVER_DETAILS} replace />} />
            <Route path={ROUTE_CONSTANTS.CLUSTER_DETAILS} element={<ClusterDetails />} />
            <Route path={ROUTE_CONSTANTS.REQUESTS} element={<Requests />} />
            <Route path={ROUTE_CONSTANTS.SEARCH} element={<Search />} />
            <Route path={ROUTE_CONSTANTS.SERVER_MONITORING} element={<ServerMonitoring />} />
            <Route path={ROUTE_CONSTANTS.SERVER_PING_MONITORING} element={<ServerPingMonitoring />} />
            <Route path={ROUTE_CONSTANTS.ATTENDANCE} element={<Attendance />} />
            <Route path={ROUTE_CONSTANTS.AUDIT_LOGS} element={<AuditLogs />} />
            <Route path={ROUTE_CONSTANTS.DOCUMENTATIONS} element={<Documentations />} />
            <Route path={ROUTE_CONSTANTS.BMS_CHECKLIST} element={<BMSChecklist />} />
            <Route path={ROUTE_CONSTANTS.CLUSTER_CHECKLIST} element={<ClusterChecklist />} />
            <Route path={ROUTE_CONSTANTS.VISITOR_LOGS} element={<VisitorLogs />} />
            <Route path={ROUTE_CONSTANTS.DAILY_ACTIVITIES} element={<DailyActivities />} />
            <Route path={ROUTE_CONSTANTS.PERIODIC_ACTIVITIES} element={<PeriodicActivities />} />
            <Route path={ROUTE_CONSTANTS.ANNOUNCEMENTS} element={<Announcements />} />
            <Route path={ROUTE_CONSTANTS.OPERATION_LOGS} element={<OperationLogs />} />
            <Route path={ROUTE_CONSTANTS.IP_LIST} element={<IpList />} />
            <Route path={ROUTE_CONSTANTS.SERVER_DETAILS} element={<ServerDetails />} />
            <Route path={ROUTE_CONSTANTS.PHONE_DIRECTORY} element={<PhoneDirectory />} />
            <Route path={ROUTE_CONSTANTS.SALARY} element={<Salary />} />
          </Route>

          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default AppRouter;
