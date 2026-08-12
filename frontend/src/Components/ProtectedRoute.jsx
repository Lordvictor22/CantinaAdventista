import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRoles }) {
  // Pega as informações do usuário salvo no login
  const storedUser = localStorage.getItem('user');
  const user = storedUser ? JSON.parse(storedUser) : null;

  // 1. Se não estiver logado, redireciona para o login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 2. Se a rota exige um perfil específico e o usuário não tem esse perfil
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // AJUSTADO: Redireciona o aluno para a rota correta dele (/student)
    return <Navigate to="/student" replace />;
  }

  // 3. Se estiver tudo OK, exibe a página normalmente
  return children;
}