import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import ProtectedRoute from './Components/ProtectedRoute';

import Login from './Components/pages/Login';
import CashierPanel from './Components/pages/CashierPanel';
import CanteenDashboard from './Components/pages/canteen';
import StudentMenu from './Components/pages/StudentMenu';
import ParentWallet from './Components/pages/ParentWallet';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* =========================
            ROTA INICIAL
        ========================== */}
        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />


        {/* =========================
            LOGIN
        ========================== */}
        <Route
          path="/login"
          element={<Login />}
        />


        {/* =========================
            ÁREA DO ALUNO
        ========================== */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <StudentMenu />
            </ProtectedRoute>
          }
        />


        {/* =========================
            ÁREA DOS PAIS
        ========================== */}
        <Route
          path="/parent"
          element={
            <ProtectedRoute allowedRoles={['parent', 'admin']}>
              <ParentWallet />
            </ProtectedRoute>
          }
        />


        {/* =========================
            ÁREA DO CAIXA
        ========================== */}
        <Route
          path="/cashier"
          element={
            <ProtectedRoute allowedRoles={['cashier', 'canteen', 'admin']}>
              <CashierPanel />
            </ProtectedRoute>
          }
        />


        {/* =========================
            ÁREA DA CANTINA
        ========================== */}
        <Route
          path="/canteen"
          element={
            <ProtectedRoute allowedRoles={['canteen', 'admin']}>
              <CanteenDashboard />
            </ProtectedRoute>
          }
        />


        {/* =========================
            ÁREA ADMINISTRATIVA
        ========================== */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <CanteenDashboard />
            </ProtectedRoute>
          }
        />


        {/* =========================
            ROTAS DESCONHECIDAS
        ========================== */}
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}