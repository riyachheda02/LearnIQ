// src/App.jsx
import React from "react";
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import Layout from "./components/Layout";
import DashBoard from "./pages/DashBoard";
import Ask from "./pages/Ask";
import Community from "./pages/Community";
import Folders from "./pages/Folders";
import Settings from "./pages/Settings";
import Login from "./login";
import Register from "./register";
import AboutUs from "./pages/AboutUs";
import Schedule from "./pages/Schedule";
import Quiz from "./pages/Quiz";

const router = createBrowserRouter([
  // Public / auth routes (no layout)
  { path: "/",        element: <Login /> },
  { path: "/login",   element: <Login /> },
  { path: "/register",element: <Register /> },

  // Main app routes wrapped by Layout
  {
    element: <Layout />,
    children: [
      { path: "/DashBoard", element: <DashBoard /> },
      { path: "/Ask",       element: <Ask /> },
      { path: "/Community", element: <Community /> },
      { path: "/Folders",   element: <Folders /> },
      { path: "/Schedule",  element: <Schedule /> },
      { path: "/Settings",  element: <Settings /> },
      { path: "/AboutUs",   element: <AboutUs /> },
      { path: "/Quiz",      element: <Quiz /> },
    ],
  },

  // catch-all
  { path: "*", element: <DashBoard /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}

