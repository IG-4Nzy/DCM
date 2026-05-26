import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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

const Clusters = lazy(() => import("../pages/Clusters"));
const ClusterDetails = lazy(() => import("../pages/Clusters/ClusterDetails"));
const Requests = lazy(() => import("../pages/Requests"));
const Search = lazy(() => import("../pages/Search"));
const ServerMonitoring = lazy(() => import("../pages/ServerMonitoring"));


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
            <Route path={ROUTE_CONSTANTS.CLUSTER} element={<Clusters />} />
            <Route path={ROUTE_CONSTANTS.CLUSTER_DETAILS} element={<ClusterDetails />} />
            <Route path={ROUTE_CONSTANTS.REQUESTS} element={<Requests />} />
            <Route path={ROUTE_CONSTANTS.SEARCH} element={<Search />} />
            <Route path={ROUTE_CONSTANTS.SERVER_MONITORING} element={<ServerMonitoring />} />
          </Route>

          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default AppRouter;
