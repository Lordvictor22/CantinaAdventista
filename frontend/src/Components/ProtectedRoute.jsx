import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRoles }) {
  const storedUser = localStorage.getItem('user');

  let user = null;

  try {
    user = storedUser ? JSON.parse(storedUser) : null;
  } catch {
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }

  // Não está logado
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Não tem permissão
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const routesByRole = {
      student: '/student',
      parent: '/parent',
      cashier: '/cashier',
      canteen: '/canteen',
      admin: '/admin'
    };

    return (
      <Navigate
        to={routesByRole[user.role] || '/login'}
        replace
      />
    );
  }

  return children;
}