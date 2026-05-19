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
          </Route>

          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default AppRouter;
