import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import logoAdventista from '../../assets/logoAdventistaCentenario.png';
import logoGostosoSabor from '../../assets/GostososaborlogoreduzidoGIMP.png';
import './MenuPage.css';

const PIX_KEY = "suachavepix@email.com"; 

// Dias da semana disponíveis para escolha
const WEEK_DAYS = [
  { id: 'segunda', label: 'Segunda', dayIndex: 1 },
  { id: 'terca',   label: 'Terça',   dayIndex: 2 },
  { id: 'quarta',  label: 'Quarta',  dayIndex: 3 },
  { id: 'quinta',  label: 'Quinta',  dayIndex: 4 },
  { id: 'sexta',   label: 'Sexta',   dayIndex: 5 }
];

// Identifica o dia da semana atual (0 = Dom, 1 = Seg, ..., 6 = Sáb)
const getCurrentDayOfWeek = () => {
  const today = new Date();
  const dayIndex = today.getDay();
  const currentDay = WEEK_DAYS.find(day => day.dayIndex === dayIndex);
  return currentDay ? currentDay.id : 'segunda';
};

// Calcula a data YYYY-MM-DD a partir do dia da semana selecionado
const getISOFromDayOfWeek = (selectedDayId) => {
  const today = new Date();
  const currentDayIndex = today.getDay();
  
  const targetDay = WEEK_DAYS.find(day => day.id === selectedDayId);
  if (!targetDay) {
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  let diff = targetDay.dayIndex - currentDayIndex;

  if (diff < 0 || currentDayIndex === 0 || currentDayIndex === 6) {
    if (currentDayIndex === 0) diff += 1;
    else if (currentDayIndex === 6) diff += 2;
    else diff += 7;
  }

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + diff);

  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export default function StudentMenu() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentId, setStudentId] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  
  // ESTADOS DO MENU DE USUÁRIO
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const fileInputRef = useRef(null);

  // ESTADOS DA CARTEIRA / SALDO
  const [balance, setBalance] = useState(0);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  // Extrato (Statement)
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statement, setStatement] = useState([]);
  const [statementLoading, setStatementLoading] = useState(false);

  // ESTADOS DO PAINEL DO RESPONSÁVEL (CONTROLE PARENTAL)
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showParentModal, setShowParentModal] = useState(false);

  // DELETE ACCOUNT (DUAS CONFIRMAÇÕES)
  const [showDeleteModalStep1, setShowDeleteModalStep1] = useState(false);
  const [showDeleteModalStep2, setShowDeleteModalStep2] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // CACHE LOCAL DE BLOQUEIOS
  const [blockedProductIds, setBlockedProductIds] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        const savedBlocked = localStorage.getItem(`blockedProducts_${u.id}`);
        if (savedBlocked) {
          return JSON.parse(savedBlocked).map(Number);
        }
      }
    } catch (e) {
      console.error('Erro ao ler cache inicial de bloqueios:', e);
    }
    return [];
  });

  const formatDateBR = (dateString) => {
    if (!dateString) return '';
    const cleanDate = String(dateString).split('T')[0].split(' ')[0];

    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      const [year, month, day] = cleanDate.split('-');
      return `${day}/${month}/${year}`;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanDate)) {
      return cleanDate;
    }

    return cleanDate;
  };

  // ESTADOS DA RETIRADA (Dia da Semana e Turno)
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(getCurrentDayOfWeek());
  const [pickupDate, setPickupDate] = useState(() => getISOFromDayOfWeek(getCurrentDayOfWeek()));

  // Atualiza a data ISO enviada ao backend sempre que o botão do dia da semana mudar
  useEffect(() => {
    setPickupDate(getISOFromDayOfWeek(selectedDayOfWeek));
  }, [selectedDayOfWeek]);

  const [pickupTime, setPickupTime] = useState('Manhã');
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [toasts, setToasts] = useState([]);

  const categories = ['Todos', 'Salgados', 'Lanches', 'Bebidas', 'Doces'];

  const loadStudentBalance = async (idToUse) => {
    const targetId = idToUse || studentId;
    if (!targetId) return;

    try {
      const res = await api.get(`/wallet/${targetId}`);
      const rawBalance = res.data?.balance ?? res.data?.user?.balance ?? 0;
      const finalBalance = parseFloat(rawBalance) || 0;

      setBalance(finalBalance);
    } catch (err) {
      console.error('Erro ao carregar saldo:', err);
    }
  };

  const loadBlockedProducts = async (idToUse) => {
    const id = idToUse || studentId;
    if (!id) return;

    let localBlocked = [];
    const savedBlocked = localStorage.getItem(`blockedProducts_${id}`);
    if (savedBlocked) {
      try {
        localBlocked = JSON.parse(savedBlocked).map(Number);
        setBlockedProductIds(localBlocked);
      } catch (e) {
        console.error('Erro ao converter bloqueios salvos localmente:', e);
      }
    }

    try {
      const res = await api.get(`/parent/blocked/${id}`);

      if (Array.isArray(res.data) && res.data.length > 0) {
        const normalizedIds = res.data
          .map((item) => {
            const rawId =
              typeof item === 'object' && item !== null
                ? item.productId || item.product_id || item.id
                : item;
            return Number(rawId);
          })
          .filter((n) => !isNaN(n));

        setBlockedProductIds(normalizedIds);
        localStorage.setItem(`blockedProducts_${id}`, JSON.stringify(normalizedIds));
        setCart((prevCart) =>
          prevCart.filter((item) => !normalizedIds.includes(Number(item.id)))
        );
      } else {
        setBlockedProductIds(localBlocked);
      }
    } catch (err) {
      // Trata suavemente o 404 ou instabilidade na rota /parent/blocked/ Sem interromper a aplicação
      console.warn('Serviço de bloqueios indisponível ou rota não configurada. Mantendo lista local.');
      setBlockedProductIds(localBlocked);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data.filter((product) => product.available !== false));
    } catch (err) {
      showToast('Não foi possível carregar o cardápio.', 'error');
    }
  };

  const loadStudentOrders = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMyOrders([]);
      return;
    }

    setLoadingOrders(true);

    try {
      const res = await api.get('/orders/user');
      setMyOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Erro ao carregar pedidos:', err);
      setMyOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    let currentUserId = null;
    const savedUser = localStorage.getItem('user');

    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        currentUserId = user.id;
        setStudentName(user.name || '');
        setStudentEmail(user.email || '');
        setStudentId(user.id);

        if (user.balance !== undefined) {
          setBalance(Number(user.balance));
        }

        const savedAvatar = localStorage.getItem(`userAvatar_${user.id}`);
        if (savedAvatar) {
          setAvatarUrl(savedAvatar);
        } else if (user.avatar) {
          setAvatarUrl(user.avatar);
        }
      } catch (err) {
        console.error('Erro ao ler usuário do localStorage:', err);
      }
    }

    loadProducts();
    loadStudentOrders();

    if (currentUserId) {
      loadStudentBalance(currentUserId);
      loadBlockedProducts(currentUserId);
    }

    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    const interval = setInterval(() => {
      loadProducts();
      loadStudentOrders();
      const activeId = currentUserId || JSON.parse(localStorage.getItem('user'))?.id;
      if (activeId) {
        loadStudentBalance(activeId);
      }
    }, 10000);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearInterval(interval);
    };
  }, []);

  const showToast = (message, type = 'success') => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3500);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async function (event) {
        const imageBase64 = event.target.result;
        setAvatarUrl(imageBase64);
        if (studentId) {
          localStorage.setItem(`userAvatar_${studentId}`, imageBase64);
        }
        try {
          await api.put('/auth/avatar', { userId: studentId, avatar: imageBase64 });
          showToast('Foto de perfil atualizada!');
        } catch (err) {
          showToast('Foto salva localmente.', 'warning');
        }
        setShowUserMenu(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleParentAccess = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    navigate('/login');
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === '1234') { 
      setShowPinModal(false);
      setPinInput('');
      setShowParentModal(true);
    } else {
      showToast('PIN incorreto! Tente novamente.', 'error');
    }
  };

  const handleToggleBlock = async (productId) => {
    if (!studentId) return;

    const numId = Number(productId);
    const currentList = blockedProductIds.map(Number);
    const isCurrentlyBlocked = currentList.includes(numId);

    const updatedBlocked = isCurrentlyBlocked
      ? currentList.filter((id) => id !== numId)
      : [...currentList, numId];

    setBlockedProductIds(updatedBlocked);
    localStorage.setItem(`blockedProducts_${studentId}`, JSON.stringify(updatedBlocked));

    if (!isCurrentlyBlocked) {
      setCart((prev) => prev.filter((item) => Number(item.id) !== numId));
    }

    try {
      await api.post(
        '/parent/toggle-block',
        {
          studentId: Number(studentId),
          productId: numId,
          student_id: Number(studentId),
          product_id: numId
        }
      );
      showToast(isCurrentlyBlocked ? 'Alimento liberado!' : 'Alimento bloqueado para o aluno.');
    } catch (err) {
      showToast('Salvo com sucesso no aparelho.', 'warning');
    }
  };

  const addToCart = (product) => {
    if (product.stock !== undefined && product.stock <= 0) {
      showToast('Produto esgotado!', 'error');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => Number(item.id) === Number(product.id));
      if (existing) {
        if (product.stock !== undefined && existing.quantity >= product.stock) {
          showToast(`Limite do estoque atingido (${product.stock} un.).`, 'error');
          return prev;
        }
        return prev.map((item) =>
          Number(item.id) === Number(product.id) ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    showToast(`${product.name} adicionado ao pedido.`);
  };

  const updateQuantity = (id, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (Number(item.id) === Number(id)) {
            const newQuantity = item.quantity + delta;
            if (delta > 0 && item.stock !== undefined && newQuantity > item.stock) {
              showToast(`Limite máximo do estoque atingido (${item.stock} un.).`, 'error');
              return item;
            }
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const cartQuantity = cart.reduce((acc, item) => acc + item.quantity, 0);

  const formatMoney = (val) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(val) || 0);
  };

  const visibleProducts = products.filter(
    (p) => !blockedProductIds.map(Number).includes(Number(p.id))
  );

  const filteredProducts =
    selectedCategory === 'Todos'
      ? visibleProducts
      : visibleProducts.filter(
          (p) => p.category?.toLowerCase() === selectedCategory.toLowerCase()
        );

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast('Adicione pelo menos um item ao pedido.', 'error');
      return;
    }

    if (!studentName.trim()) {
      showToast('Não encontramos o nome do aluno.', 'error');
      return;
    }

    if (!pickupDate || !pickupTime) {
      showToast('Selecione o dia da semana e o turno para retirada.', 'error');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');

      const dayMap = {
        'Segunda': 1,
        'Terça': 2,
        'Quarta': 3,
        'Quinta': 4,
        'Sexta': 5,
        'Sábado': 6,
        'Domingo': 0
      };

      let formattedDate = pickupDate;

      if (dayMap[pickupDate] !== undefined) {
        const today = new Date();
        const targetDay = dayMap[pickupDate];
        let diff = targetDay - today.getDay();
        if (diff < 0) diff += 7;
        
        const nextDate = new Date();
        nextDate.setDate(today.getDate() + diff);
        formattedDate = nextDate.toISOString().split('T')[0];
      }

      const payload = {
        student_name: studentName,
        pickup_date: formattedDate,
        pickup_time: pickupTime,
        items: cart.map(item => ({
          id: Number(item.id || item.product_id),
          quantity: Number(item.quantity || 1)
        }))
      };

      console.log('Enviando pedido para API:', payload);

      await api.post('/orders', payload, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      showToast('Pedido agendado com sucesso! 🎉');
      setCart([]);

      const activeId = studentId || JSON.parse(localStorage.getItem('user'))?.id;

      if (activeId) {
        await Promise.all([
          loadStudentOrders ? loadStudentOrders() : Promise.resolve(),
          loadStudentBalance ? loadStudentBalance(activeId) : Promise.resolve()
        ]);
      }
    } catch (err) {
      console.error('Erro detalhado da API ao criar pedido:', err.response?.data || err.message);

      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Erro ao processar o pedido.';

      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPixKey = () => {
    if (typeof PIX_KEY !== 'undefined' && PIX_KEY) {
      navigator.clipboard.writeText(PIX_KEY);
      showToast('Chave PIX copiada para a área de transferência!');
    } else {
      showToast('Chave PIX não configurada.', 'error');
    }
  };

  const loadStatement = async (limit = 100, offset = 0) => {
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    const id = studentId || userObj.id || userObj.student_id;

    if (!id) {
      console.error('❌ ID do usuário não encontrado para carregar extrato.');
      showToast('Não foi possível identificar o usuário.', 'error');
      return;
    }

    setStatementLoading(true);
    setStatement([]);

    try {
      console.log('📄 Carregando extrato do aluno:', id);

      const res = await api.get(
        `/wallet/student/${id}/statement?limit=${limit}&offset=${offset}`
      );

      console.log('📄 Extrato recebido:', res.data);

      const transactions = Array.isArray(res.data?.transactions)
        ? res.data.transactions
        : [];

      setStatement(transactions);

    } catch (err) {
      console.error(
        '❌ Erro ao carregar extrato:',
        err.response?.status,
        err.response?.data || err.message
      );

      showToast(
        err.response?.data?.error ||
        'Não foi possível carregar o extrato.',
        'error'
      );

      setStatement([]);
    } finally {
      setStatementLoading(false);
    }
  };

  const exportStatementCSV = () => {
    if (!statement || statement.length === 0) {
      showToast('Extrato vazio.', 'warning');
      return;
    }

    const headers = ['Data', 'Tipo', 'Descrição', 'Valor'];

    const rows = statement.map((s) => [
      formatDateBR(s.created_at),

      s.type === 'DEPOSIT'
        ? 'Recarga'
        : s.type === 'PURCHASE'
          ? 'Compra'
          : s.type,

      (s.description || 'Sem descrição')
        .replace(/\n/g, ' ')
        .replace(/,/g, ' '),

      Number(s.amount).toFixed(2)
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob(
      ['\uFEFF' + csvContent],
      { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `extrato_${studentId || 'user'}.csv`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    showToast('Extrato exportado com sucesso!');
  };

  const requestDeleteAccount = () => {
    setShowDeleteModalStep1(true);
  };

  const proceedToFinalDelete = () => {
    setShowDeleteModalStep1(false);
    setShowDeleteModalStep2(true);
  };

  const confirmDeleteAccount = async () => {
    const savedUser = JSON.parse(localStorage.getItem('user') || 'null');
    const expected = savedUser?.email?.toLowerCase?.() || '';
    if ((deleteConfirmInput || '').trim().toLowerCase() !== expected) {
      showToast('Por favor digite o endereço de e-mail para confirmar.', 'error');
      return;
    }

    try {
      await api.delete('/auth/delete');
      showToast('Conta excluída. Seus dados pessoais foram removidos onde permitido.', 'success');

      localStorage.removeItem('token');
      localStorage.removeItem('user');

      navigate('/login');
    } catch (err) {
      console.error('Erro ao excluir conta:', err);
      showToast(err.response?.data?.error || 'Erro ao excluir conta.', 'error');
    } finally {
      setShowDeleteModalStep2(false);
      setDeleteConfirmInput('');
    }
  };

  return (
    <div className="page-wrapper">
      {/* TOASTS */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span className="toast-icon">
              {toast.type === 'success' ? '✓' : '!'}
            </span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarChange}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {/* HEADER */}
      <header className="adventist-header" style={{background: 'linear-gradient(90deg, #E94055, #C52E45)', color: '#ffffff'}}>
        <div className="brand-section">
          <img src={logoGostosoSabor} alt="Gostoso Sabor" className="logo-adventista-header logo-gostoso" />
          <div className="school-info">
            <span className="school-name">Gostoso Sabor</span>
            <span className="school-location">Cantina</span>
          </div>
        </div>
 
        <nav className="header-navigation">
          <div className="user-profile-menu" ref={userMenuRef}>
            <button
              type="button"
              className="user-avatar-btn"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Perfil" className="user-avatar-img" />
              ) : (
                <div className="user-avatar-fallback">
                  {studentName ? studentName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </button>

            {showUserMenu && (
              <div className="user-dropdown-menu">
                <div className="user-dropdown-header">
                  <p className="user-dropdown-name">{studentName || 'Usuário'}</p>
                  {studentEmail && (
                    <p className="user-dropdown-email">{studentEmail}</p>
                  )}
                </div>

                <button
                  type="button"
                  className="user-dropdown-item"
                  onClick={() => fileInputRef.current?.click()}
                >
                  📷 Alterar Foto
                </button>

                <button
                  type="button"
                  className="user-dropdown-item highlight"
                  onClick={() => {
                    setShowUserMenu(false);
                    handleLogout();
                  }}
                >
                  🔐 Acessar conta do responsável
                </button>

                <div className="user-dropdown-divider" />

                <button
                  type="button"
                  className="user-dropdown-item"
                  onClick={() => { setShowUserMenu(false); setShowDeleteModalStep1(true); }}
                >
                  ❌ Excluir minha conta
                </button>

                <button
                  type="button"
                  className="user-dropdown-item logout"
                  onClick={handleLogout}
                >
                  🚪 Sair da Conta
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

     {/* CONTEÚDO PRINCIPAL */}
      <main className="menu-container">
        <div className="main-content">
          <section className="welcome-section">
            <div>
              <span className="section-kicker">CANTINA ESCOLAR</span>
              <h1>Olá, {studentName || 'aluno'}! 👋</h1>
              <p>Escolha seu lanche para o próximo recreio.</p>
            </div>

            <div className="welcome-widgets">
              {/* CARD DE SALDO REAL */}
              <div className="wallet-badge">
                <div>
                  <span className="wallet-label">SEU SALDO</span>
                  <strong className="wallet-amount">{formatMoney(balance)}</strong>
                </div>
                <div className="wallet-actions">
                  <button
                    type="button"
                    className="btn-add-balance"
                    onClick={() => setShowRechargeModal(true)}
                  >
                    ➕ Adicionar Saldo
                  </button>

                  <button 
                    className="btn-statement"
                    onClick={() => {
                      setShowStatementModal(true);
                      loadStatement();
                    }}
                  >
                    📄 Ver Extrato
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="schedule-card">
            <div className="schedule-title">
              <div>
                <h2>Quando você vai retirar?</h2>
                <p>Escolha o dia da semana e o turno.</p>
              </div>
            </div>

            <div className="schedule-fields">
              <div className="input-group">
                <label>DIA DA SEMANA</label>
                <div className="week-days-selector" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {WEEK_DAYS.map((day) => (
                    <button
                      key={day.id}
                      type="button"
                      className={`day-btn ${selectedDayOfWeek === day.id ? 'active' : ''}`}
                      onClick={() => setSelectedDayOfWeek(day.id)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: selectedDayOfWeek === day.id ? '#E94055' : '#ffffff',
                        color: selectedDayOfWeek === day.id ? '#ffffff' : '#334155',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="pickupTime">TURNO</label>
                <select
                  id="pickupTime"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                >
                  <option value="Manhã">Manhã</option>
                  <option value="Tarde">Tarde</option>
                </select>
              </div>
            </div>
          </section>

          <section className="products-section">
            <div className="category-tabs">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`tab-btn ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="products-grid">
              {filteredProducts.map((product) => {
                const cartItem = cart.find((item) => Number(item.id) === Number(product.id));
                const isOutOfStock = product.stock !== undefined && product.stock <= 0;
                const isMaxReached = cartItem && product.stock !== undefined && cartItem.quantity >= product.stock;

                return (
                  <article key={product.id} className="product-item">
                    <div className="product-image-container">
                      {product.image_url && product.image_url.trim() !== '' ? (
                        <img src={product.image_url} alt={product.name} className="product-image" />
                      ) : (
                        <div className="no-photo-placeholder">📷 Sem foto</div>
                      )}
                    </div>

                    <div className="product-info">
                      <h3 className="product-title">{product.name}</h3>
                      {product.description && (
                        <p className="product-description">{product.description}</p>
                      )}
                      
                      <div className="product-price-row">
                        <span className="product-price">{formatMoney(product.price)}</span>
                        <span className={`stock-badge ${isOutOfStock ? 'out-of-stock' : 'in-stock'}`}>
                          {isOutOfStock ? 'Esgotado' : `Estoque: ${product.stock ?? 0}`}
                        </span>
                      </div>
                    </div>

                    <div className="product-action">
                      {cartItem ? (
                        <div className="product-qty-controls">
                          <button type="button" className="qty-btn" onClick={() => updateQuantity(product.id, -1)}>−</button>
                          <span className="quantity">{cartItem.quantity}</span>
                          <button 
                            type="button" 
                            className="qty-btn" 
                            onClick={() => updateQuantity(product.id, 1)}
                            disabled={isMaxReached}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button 
                          type="button" 
                          className="btn-add" 
                          onClick={() => addToCart(product)}
                          disabled={isOutOfStock}
                        >
                          {isOutOfStock ? 'Esgotado' : '+ Adicionar'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside id="pedido" className="sidebar">
          {/* BLOCO 1: NOVO PEDIDO / CARRINHO */}
          <div className="cart-card">
            <div className="cart-header">
              <h2>Novo Pedido</h2>
              <span>{cartQuantity} itens</span>
            </div>

            {cart.length === 0 ? (
              <p className="empty-cart-msg">Nenhum item selecionado.</p>
            ) : (
              <>
                <div className="cart-list">
                  {cart.map((item) => (
                    <div key={item.id} className="cart-item">
                      <span>{item.name} (x{item.quantity})</span>
                      <span>{formatMoney(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="summary-total">
                  <span>Total:</span>
                  <strong>{formatMoney(cartTotal)}</strong>
                </div>

                <button
                  type="button"
                  className="btn-checkout"
                  onClick={handleCheckout}
                  disabled={loading}
                >
                  {loading ? 'Enviando...' : 'Confirmar pedido'}
                </button>
              </>
            )}
          </div>

          {/* BLOCO 2: MEUS PEDIDOS REALIZADOS */}
          <div className="history-card">
            <div className="cart-header">
              <h2>Meus Pedidos Realizados</h2>
            </div>

            {loadingOrders ? (
              <p className="empty-cart-msg">Carregando histórico...</p>
            ) : !myOrders || myOrders.length === 0 ? (
              <p className="empty-cart-msg">Você ainda não realizou nenhum pedido.</p>
            ) : (
              <div className="history-list">
                {myOrders.slice(0, 5).map((order) => (
                  <div key={order.id} className="history-item-card">
                    <div className="history-item-header">
                      <strong>Pedido #{order.id}</strong>
                      <span className={`status-tag ${order.status?.toLowerCase() || 'pago'}`}>
                        {order.status || 'pago'}
                      </span>
                    </div>
                    
                    <p className="history-date">
                      Retirada: {formatDateBR ? formatDateBR(order.pickup_date) : order.pickup_date} {order.pickup_time ? `• ${order.pickup_time}` : ''}
                    </p>

                    <ul className="history-products">
                      {order.items && order.items.length > 0 ? (
                        order.items.map((item, idx) => (
                          <li key={item.id || idx} className="history-product-line">
                            <span>{item.quantity}x {item.product_name || item.name || `Item #${item.product_id}`}</span>
                            <span>{formatMoney(Number(item.price || 0))}</span>
                          </li>
                        ))
                      ) : (
                        <li className="history-product-line">
                          <span>Itens indisponíveis</span>
                        </li>
                      )}
                    </ul>

                    <hr className="history-divider" />

                    <div className="history-total-row">
                      <span>Total:</span>
                      <strong>{formatMoney(Number(order.total || order.total_amount || 0))}</strong>
                    </div>
                  </div>
                ))}
              </div>  
            )}
          </div>
        </aside>
      </main>

      {/* BARRA FLUTUANTE MOBILE */}
      {cart.length > 0 && (
        <div className="mobile-floating-cart">
          <div className="floating-cart-info">
            <span className="floating-cart-count">
              {cartQuantity} {cartQuantity === 1 ? 'item' : 'itens'}
            </span>
            <span className="floating-cart-total">{formatMoney(cartTotal)}</span>
          </div>

          <button
            type="button"
            className="btn-floating-checkout"
            onClick={() => setIsCartModalOpen(true)}
          >
            Ver Carrinho 🛒
          </button>
        </div>
      )}

      {/* MODAL CARRINHO */}
      {isCartModalOpen && (
        <div className="cart-modal-overlay" onClick={() => setIsCartModalOpen(false)}>
          <div className="cart-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="cart-modal-header">
              <h3>Resumo do Pedido</h3>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setIsCartModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="cart-modal-body">
              {cart.length === 0 ? (
                <p className="empty-cart-msg">Seu carrinho está vazio.</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="cart-modal-item">
                    <div className="cart-modal-item-info">
                      <div>
                        <span className="item-name">{item.name}</span>
                        <div className="product-qty-controls" style={{marginTop:6}}>
                          <button type="button" className="qty-btn" onClick={() => updateQuantity(item.id, -1)}>-</button>
                          <span className="quantity">{item.quantity}</span>
                          <button type="button" className="qty-btn" onClick={() => updateQuantity(item.id, +1)}>+</button>
                          <button type="button" className="btn-cancel-modal" style={{marginLeft:12,padding:'6px 10px',height:'32px'}} onClick={() => setCart(prev => prev.filter(i => Number(i.id) !== Number(item.id)))}>Remover</button>
                        </div>
                      </div>
                    </div>
                    <span className="item-subtotal">
                      {formatMoney(item.price * item.quantity)}
                    </span>
                  </div>
                ))
              )}

              <div className="cart-modal-summary">
                <span>Total a Pagar:</span>
                <strong>{formatMoney(cartTotal)}</strong>
              </div>
            </div>

            <div className="cart-modal-actions">
              <button
                type="button"
                className="btn-cancel-modal"
                onClick={() => setIsCartModalOpen(false)}
              >
                Continuar Comprando
              </button>
              
              <button
                type="button"
                className="btn-confirm-checkout"
                onClick={() => {
                  setIsCartModalOpen(false);
                  handleCheckout();
                }}
              >
                Confirmar e Pagar ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECARGA VIA PIX */}
      {showRechargeModal && (
        <div className="modal-overlay" onClick={() => setShowRechargeModal(false)}>
          <div className="modal-card modal-card-sm" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-icon" onClick={() => setShowRechargeModal(false)}>✕</button>
            <h3 className="modal-title">💳 Recarga via PIX</h3>
            <p className="modal-subtitle">
              Utilize a chave PIX abaixo para adicionar saldo à conta do aluno:
            </p>

            <div className="pix-key-box" onClick={handleCopyPixKey}>
              <code>{PIX_KEY}</code>
              <button type="button" className="btn-copy-pix">Copiar</button>
            </div>

            <p className="pix-instructions">
              Após realizar a transferência, o saldo será creditado assim que a transação for confirmada.
            </p>

            <button
              type="button"
              className="btn-checkout btn-full"
              onClick={() => setShowRechargeModal(false)}
            >
              Concluir
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE VALIDAÇÃO DE SENHA DO RESPONSÁVEL */}
      {showPinModal && (
        <div className="modal-overlay" onClick={() => setShowPinModal(false)}>
          <div className="modal-card modal-card-sm" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-icon" onClick={() => setShowPinModal(false)}>✕</button>
            <h3 className="modal-title">Acesso do Responsável</h3>
            <p className="modal-subtitle">
              Digite a senha/PIN do responsável para gerenciar os alimentos permitidos.
            </p>

            <form onSubmit={handlePinSubmit}>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="4"
                placeholder="Ex: 1234"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="pin-input-field"
                autoFocus
              />
              <p className="pin-hint">
                🔒 Senha padrão: <strong>1234</strong>
              </p>

              <button type="submit" className="btn-checkout btn-full">
                Entrar no Painel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DO PAINEL DE CONTROLE DOS PAIS */}
      {showParentModal && (
        <div className="modal-overlay" onClick={() => setShowParentModal(false)}>
          <div className="modal-card modal-card-lg" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close-icon"
              onClick={() => setShowParentModal(false)}
            >
              ✕
            </button>

            <h3 className="modal-title">🛍️ Painel de Restrições dos Pais</h3>
            <p className="modal-subtitle">
              Selecione os alimentos para alternar entre <strong>Permitido</strong> e <strong>Bloqueado</strong> na conta do aluno:
            </p>

            <div className="parent-products-list">
              {products.length === 0 ? (
                <p>Nenhum produto cadastrado no momento.</p>
              ) : (
                products.map((product) => {
                  const isBlocked = blockedProductIds.includes(Number(product.id));
                  return (
                   <div key={product.id} className={`parent-product-item ${isBlocked ? 'blocked' : 'allowed'}`}>
                      <div className="parent-product-info">
                       <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:44,height:44,background:'#f1f5f9',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:'#6b7280'}}>
                            🍽️
                          </div>
                          <div>
                            <strong className="parent-product-name">{product.name}</strong>
                            <div className="parent-product-meta">{product.category} • {product.description ? product.description.substring(0,60) : ''}</div>
                          </div>
                       </div>

                       <div className="parent-product-price">{formatMoney(product.price)}</div>
                      </div>

                      <button
                        type="button"
                        className={`btn-toggle-block ${isBlocked ? 'is-blocked' : 'is-allowed'}`}
                        onClick={() => handleToggleBlock(product.id)}
                      >
                        {isBlocked ? '🔒 Bloqueado' : '✅ Permitido'}
                      </button>
                   </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              className="btn-checkout btn-full"
              style={{ marginTop: '1.25rem' }}
              onClick={() => setShowParentModal(false)}
            >
              Concluir Alterações
            </button>
          </div>
        </div>
      )}

      {/* MODAL DO EXTRATO / STATEMENT */}
      {showStatementModal && (
        <div className="modal-overlay" onClick={() => setShowStatementModal(false)}>
          <div className="modal-card modal-card-lg" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-icon" onClick={() => setShowStatementModal(false)}>✕</button>
            <h3 className="modal-title">Extrato</h3>
            <p className="modal-subtitle">Últimas movimentações da conta (saldo atual: <strong>{formatMoney(balance)}</strong>).</p>

            <div className="statement-list">
              {statementLoading ? (
                <p>Carregando extrato...</p>
              ) : statement.length === 0 ? (
                <p>Nenhuma movimentação encontrada.</p>
              ) : (
                <table className="statement-table">
                 <thead>
                    <tr>
                      <th style={{ width: '120px' }}>Data</th>
                      <th style={{ width: '140px' }}>Tipo</th>
                      <th>Descrição</th>
                      <th style={{ width: '140px', textAlign: 'right' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.map((tx) => (
                      <tr key={tx.id}>
                        <td>{formatDateBR(tx.created_at)}</td>

                        <td>
                          {tx.type === 'DEPOSIT'
                              ? '➕ Recarga'
                              : tx.type === 'PURCHASE'
                              ? '🛒 Compra'
                              : tx.type}
                        </td>

                        <td style={{ whiteSpace: 'normal', maxWidth: 360 }}>
                          {tx.description || 'Sem descrição'}
                        </td>

                        <td
                          className={`amount ${
                            Number(tx.amount) >= 0
                              ? 'amount-positive'
                              : 'amount-negative'
                          }`}
                        >
                          {Number(tx.amount) >= 0 ? '+' : ''}
                          {formatMoney(tx.amount)}
                        </td>

                        <td className="amount">—</td>
                        <td className="amount">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button type="button" className="btn-checkout" onClick={() => exportStatementCSV()}>Exportar CSV</button>
              <button type="button" className="btn-cancel-modal" onClick={() => setShowStatementModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAIS DE EXCLUSÃO DE CONTA (DUAS ETAPAS) */}
      {showDeleteModalStep1 && (
        <div className="modal-overlay" onClick={() => setShowDeleteModalStep1(false)}>
          <div className="modal-card modal-card-sm" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-icon" onClick={() => setShowDeleteModalStep1(false)}>✕</button>
            <h3 className="modal-title">Atenção: Excluir Conta</h3>
            <p className="modal-subtitle">Por lei, alguns registros (logs de transações) precisam ser mantidos por até 6 meses. Ao prosseguir, os dados pessoais serão removidos sempre que permitido pela legislação; registros técnicos necessários para auditoria serão retidos e, quando possível, anonimizados.</p>

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="button" className="btn-cancel-modal" onClick={() => setShowDeleteModalStep1(false)}>Cancelar</button>
              <button type="button" className="btn-confirm-checkout" onClick={proceedToFinalDelete}>Excluir minha conta</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModalStep2 && (
        <div className="modal-overlay" onClick={() => setShowDeleteModalStep2(false)}>
          <div className="modal-card modal-card-sm" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-icon" onClick={() => setShowDeleteModalStep2(false)}>✕</button>
            <h3 className="modal-title">Confirmação Final</h3>
            <p className="modal-subtitle">Para confirmar, digite seu e-mail cadastrado abaixo e clique em "Excluir permanentemente". Esta ação não pode ser revertida.</p>

            <input
              type="text"
              placeholder={studentEmail || 'Seu e-mail'}
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              className="confirm-input"
              style={{marginTop:8}}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="button" className="btn-cancel-modal" onClick={() => setShowDeleteModalStep2(false)}>Voltar</button>
              <button type="button" className="btn-danger" onClick={confirmDeleteAccount}>Excluir permanentemente</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}