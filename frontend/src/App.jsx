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
        {/* Rota Pública */}
        <Route path="/login" element={<Login />} />

        {/* Rotas Protegidas */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <StudentMenu />
            </ProtectedRoute>
          }
        />

        <Route
          path="/parent-wallet"
          element={
            <ProtectedRoute allowedRoles={['parent', 'admin']}>
              <ParentWallet />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cashier"
          element={
            <ProtectedRoute allowedRoles={['cashier', 'admin']}>
              <CashierPanel />
            </ProtectedRoute>
          }
        />

        <Route
          path="/canteen"
          element={
            <ProtectedRoute allowedRoles={['canteen', 'admin']}>
              <CanteenDashboard />
            </ProtectedRoute>
          }
        />

        {/* Rota Admin utilizando o painel CanteenDashboard existente */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin', 'canteen']}>
              <CanteenDashboard />
            </ProtectedRoute>
          }
        />

        {/* Redirecionamento padrão */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}