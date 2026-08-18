import { Link, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const location = useLocation();

  const savedUser = localStorage.getItem('user');
  const user = savedUser ? JSON.parse(savedUser) : null;

  if (!user) return null;

  const isActive = (path) => location.pathname === path;

  return (
    <aside style={styles.sidebar}>
      <ul style={styles.navList}>
        {/* Visível para alunos */}
        {(user.role === 'student' || user.role === 'admin') && (
          <li>
            <Link
              to="/student"
              style={isActive('/student') ? styles.activeLink : styles.link}
            >
              🛒 Fazer Pedido
            </Link>
          </li>
        )}

        {/* Visível para caixa */}
        {(user.role === 'cashier' || user.role === 'canteen' || user.role === 'admin') && (
          <li>
            <Link
              to="/cashier"
              style={isActive('/cashier') ? styles.activeLink : styles.link}
            >
              💵 Painel do Caixa
            </Link>
          </li>
        )}

        {/* Visível para equipe da cantina */}
        {(user.role === 'canteen' || user.role === 'admin') && (
          <li>
            <Link
              to="/canteen"
              style={isActive('/canteen') ? styles.activeLink : styles.link}
            >
              🍳 Fila de Preparo
            </Link>
          </li>
        )}

        {/* Visível apenas para administradores */}
        {user.role === 'admin' && (
          <li>
            <Link
              to="/menu-admin"
              style={isActive('/menu-admin') ? styles.activeLink : styles.link}
            >
              ⚙️ Gerenciar Cardápio
            </Link>
          </li>
        )}
      </ul>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: '220px',
    borderRight: '1px solid var(--border)',
    padding: '20px 10px',
    minHeight: 'calc(100vh - 60px)',
  },
  navList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  link: {
    display: 'block',
    padding: '10px 15px',
    color: 'var(--text)',
    textDecoration: 'none',
    borderRadius: '6px',
  },
  activeLink: {
    display: 'block',
    padding: '10px 15px',
    color: 'var(--accent)',
    backgroundColor: 'var(--accent-bg)',
    fontWeight: 'bold',
    textDecoration: 'none',
    borderRadius: '6px',
  },
};