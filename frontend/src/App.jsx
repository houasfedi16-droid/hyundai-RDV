import { BrowserRouter, Routes, Route } from "react-router-dom";

import DashboardClient from "./pages/DashboardClient";
import BookAppointment from "./pages/BookAppointment";
import MyAppointments from "./pages/MyAppointments";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./ProtectedRoute";
import OtpLogin from "./pages/OtpLogin";
import OcrScan from "./pages/OcrScan";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Confirmation from "./pages/Confirmation";
import Payment from "./pages/Payment";
import Chatbot from "./components/Chatbot";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* LOGIN */}
        <Route path="/" element={<Login />} />

        {/* REGISTER */}
        <Route path="/register" element={<Register />} />

        {/* OTP */}
        <Route path="/otp-login" element={<OtpLogin />} />

        {/* OCR */}
        <Route
          path="/ocr"
          element={
            <ProtectedRoute>
              <OcrScan />
            </ProtectedRoute>
          }
        />

        {/* CLIENT DASHBOARD */}
        <Route
          path="/client-dashboard"
          element={
            <ProtectedRoute>
              <DashboardClient />
            </ProtectedRoute>
          }
        />

        {/* BOOK APPOINTMENT */}
        <Route
          path="/book"
          element={
            <ProtectedRoute>
              <BookAppointment />
            </ProtectedRoute>
          }
        />

        {/* MY APPOINTMENTS */}
        <Route
          path="/my-appointments"
          element={
            <ProtectedRoute>
              <MyAppointments />
            </ProtectedRoute>
          }
        />

        {/* CONFIRMATION */}
        <Route
          path="/confirmation"
          element={
            <ProtectedRoute>
              <Confirmation />
            </ProtectedRoute>
          }
        />

        {/* PAYMENT */}
        <Route
          path="/payment"
          element={
            <ProtectedRoute>
              <Payment />
            </ProtectedRoute>
          }
        />

        {/* ADMIN DASHBOARD */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
      <Chatbot />
    </BrowserRouter>
  );
}

export default App;
