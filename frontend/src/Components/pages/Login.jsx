import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './Login.css';
import logoAdventista from '../../assets/logoAdventistaCentenario.png';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');
    setSuccess('');
    setLoading(true);

    const endpoint = isRegister
      ? '/auth/register'
      : '/auth/login';

    const payload = isRegister
      ? { name, email, password }
      : { email, password };

    try {
      const response = await api.post(endpoint, payload);
      const data = response.data;

      if (isRegister) {
        setSuccess('Conta criada com sucesso! Faça login para continuar.');
        setIsRegister(false);
        setPassword('');
        setName('');
      } else {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Redirecionamento correto baseado na role do usuário
        const role = data.user.role;

        if (role === 'cashier') {
          navigate('/cashier');
        } else if (role === 'canteen') {
          navigate('/canteen');
        } else if (role === 'parent') {
          navigate('/parent-wallet'); // Redireciona o pai para a carteira do filho
        } else if (role === 'admin') {
          navigate('/canteen'); // Admin redirecionado para a visão da cantina
        } else {
          navigate('/student'); // Padrão para alunos
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Erro ao conectar ao servidor.'
      );
    } finally {
      setLoading(false);
    }
  };

  const changeMode = (register) => {
    setIsRegister(register);
    setError('');
    setSuccess('');
  };

  return (
    <main className="login-page">
      <div className="login-card">

        {/* Logo institucional */}
        <div className="institution-brand">
          <img
            src={logoAdventista}
            alt="Educação Adventista"
            className="adventista-logo"
          />

          <div className="brand-divider"></div>

          <div className="cantina-brand">
            <span>Cantina</span>
            <strong>+</strong>
          </div>
        </div>

        {/* Cabeçalho */}
        <div className="login-header">
          <span className="login-label">
            ÁREA DO USUÁRIO
          </span>

          <h1>
            {isRegister
              ? 'Criar uma conta'
              : 'Bem-vindo'}
          </h1>

          <p>
            {isRegister
              ? 'Preencha seus dados para começar.'
              : 'Entre para acessar a Cantina+.'}
          </p>
        </div>

        {/* Abas */}
        <div className="auth-tabs">
          <button
            type="button"
            className={!isRegister ? 'active' : ''}
            onClick={() => changeMode(false)}
          >
            Entrar
          </button>

          <button
            type="button"
            className={isRegister ? 'active' : ''}
            onClick={() => changeMode(true)}
          >
            Criar conta
          </button>
        </div>

        {/* Mensagens */}
        {error && (
          <div className="alert error">
            {error}
          </div>
        )}

        {success && (
          <div className="alert success">
            {success}
          </div>
        )}

        {/* Formulário */}
        <form
          className="login-form"
          onSubmit={handleSubmit}
        >
          {isRegister && (
            <div className="form-group">
              <label htmlFor="name">
                Nome completo
              </label>

              <input
                id="name"
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">
              E-mail
            </label>

            <input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Senha
            </label>

            <input
              id="password"
              type="password"
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading
              ? 'Aguarde...'
              : isRegister
                ? 'Criar conta'
                : 'Entrar'}
          </button>
        </form>

        <div className="login-footer">
          <span></span>
          <p>
            Cantina+ • Educação Adventista
          </p>
          <span></span>
        </div>

      </div>
    </main>
  );
}