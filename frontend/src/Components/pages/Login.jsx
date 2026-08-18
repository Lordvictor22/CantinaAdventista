import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './Login.css';
import logoGostosoSabor from '../../assets/GostososaborlogoreduzidoGIMP.png';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Tipo da conta criada
  const [role, setRole] = useState('student');

  // Termos de uso
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();


  // =========================================
  // LOGIN / CADASTRO
  // =========================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isRegister && !acceptedTerms) {
      setError(
        'É necessário aceitar os Termos de Uso e a Política de Privacidade para se cadastrar.'
      );
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    const endpoint = isRegister
      ? '/auth/register'
      : '/auth/login';

    const payload = isRegister
      ? {
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          acceptedTerms: true
        }
      : {
          email: email.trim(),
          password
        };

    try {
      const response = await api.post(endpoint, payload);
      const data = response.data;


      // =========================================
      // CADASTRO REALIZADO
      // =========================================
      if (isRegister) {
        setSuccess(
          role === 'parent'
            ? 'Conta de responsável criada com sucesso! Faça login para continuar.'
            : 'Conta de aluno criada com sucesso! Faça login para continuar.'
        );

        setIsRegister(false);

        setName('');
        setEmail('');
        setPassword('');
        setRole('student');
        setAcceptedTerms(false);

        return;
      }


      // =========================================
      // LOGIN REALIZADO
      // =========================================
      localStorage.setItem('token', data.token);
      localStorage.setItem(
        'user',
        JSON.stringify(data.user)
      );

      const userRole = data.user?.role;


      // =========================================
      // REDIRECIONAMENTO POR PERFIL
      // =========================================
      switch (userRole) {
        case 'student':
          navigate('/student');
          break;

        case 'parent':
          navigate('/parent');
          break;

        case 'cashier':
          navigate('/cashier');
          break;

        case 'canteen':
          navigate('/canteen');
          break;

        case 'admin':
          navigate('/admin');
          break;

        default:
          // Segurança caso venha um perfil desconhecido
          localStorage.removeItem('token');
          localStorage.removeItem('user');

          setError(
            'Seu perfil de usuário não possui uma área configurada no sistema.'
          );
      }

    } catch (err) {
      console.error('❌ Erro na requisição:', err);

      if (err.response) {
        setError(
          err.response.data?.error ||
          `Erro no servidor (${err.response.status})`
        );
      } else if (err.request) {
        setError(
          'O servidor não respondeu. Verifique se o backend está rodando.'
        );
      } else {
        setError(
          `Erro de execução: ${err.message}`
        );
      }

    } finally {
      setLoading(false);
    }
  };


  // =========================================
  // TROCAR ENTRE LOGIN E CADASTRO
  // =========================================
  const changeMode = (register) => {
    setIsRegister(register);

    setError('');
    setSuccess('');

    setName('');
    setEmail('');
    setPassword('');

    setRole('student');
    setAcceptedTerms(false);
  };


  return (
    <main className="login-page">
      <div className="login-card">

        {/* =========================================
            LOGO
        ========================================== */}
        <div className="institution-brand">
          <img
            src={logoGostosoSabor}
            alt="Gostoso Sabor"
            className="adventista-logo logo-gostoso"
          />

          <div className="brand-divider"></div>

          <div className="cantina-brand">
            <span>Gostoso Sabor</span>
            <strong>•</strong>
          </div>
        </div>


        {/* =========================================
            CABEÇALHO
        ========================================== */}
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
              ? 'Escolha o tipo de conta e preencha seus dados.'
              : 'Entre para acessar a Cantina+.'}
          </p>
        </div>


        {/* =========================================
            ABAS
        ========================================== */}
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


        {/* =========================================
            MENSAGENS
        ========================================== */}
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


        {/* =========================================
            FORMULÁRIO
        ========================================== */}
        <form
          className="login-form"
          onSubmit={handleSubmit}
        >

          {/* NOME */}
          {isRegister && (
            <div className="form-group">
              <label htmlFor="name">
                Nome completo
              </label>

              <input
                id="name"
                type="text"
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}


          {/* =========================================
              TIPO DE CONTA
          ========================================== */}
          {isRegister && (
            <div className="form-group">
              <label htmlFor="role">
                Tipo de conta
              </label>

              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              >
                <option value="student">
                  🎓 Sou aluno
                </option>

                <option value="parent">
                  👨‍👩‍👧 Sou pai ou responsável
                </option>
              </select>
            </div>
          )}


          {/* E-MAIL */}
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


          {/* SENHA */}
          <div className="form-group">
            <label htmlFor="password">
              Senha
            </label>

            <input
              id="password"
              type="password"
              placeholder="Mínimo de 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength="8"
              required
            />
          </div>


          {/* =========================================
              TERMOS DE USO
          ========================================== */}
          {isRegister && (
            <div className="form-group terms-group">
              <input
                id="terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) =>
                  setAcceptedTerms(e.target.checked)
                }
                required
              />

              <label htmlFor="terms">
                Li e aceito os{' '}
                <strong>Termos de Uso</strong>
                {' '}e a{' '}
                <strong>Política de Privacidade</strong>.
              </label>
            </div>
          )}


          {/* =========================================
              BOTÃO
          ========================================== */}
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


        {/* =========================================
            RODAPÉ
        ========================================== */}
        <div className="login-footer">
          <span></span>
          <p>Gostoso Sabor • Cantina</p>
          <span></span>
        </div>

      </div>
    </main>
  );
}