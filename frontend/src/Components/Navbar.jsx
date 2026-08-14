  import { useNavigate } from 'react-router-dom';

  export default function Navbar() {
    const navigate = useNavigate();

    // Recupera o usuário salvo no localStorage
    const savedUser = localStorage.getItem('user');
    const user = savedUser ? JSON.parse(savedUser) : null;

    const handleLogout = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    };

    return (
      <nav className="navbar" style={styles.nav}>
        <div style={styles.brand}>
          <h2>Cantina+</h2>
        </div>

        {user && (
          <div style={styles.userInfo}>
            <span>Olá, <strong>{user.name || 'Usuário'}</strong> ({user.role})</span>
            <button onClick={handleLogout} style={styles.logoutBtn}>
              Sair
            </button>
          </div>
        )}
      </nav>
    );
  }

  const styles = {
    nav: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 24px',
      backgroundColor: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
    },
    brand: {
      display: 'flex',
      alignItems: 'center',
    },
    userInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    },
    logoutBtn: {
      padding: '6px 12px',
      backgroundColor: '#ef4444',
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
    },
  };