import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import logoAdventista from '../../assets/logoAdventistaCentenario.png';
import logoGostosoSabor from '../../assets/GostososaborlogoreduzidoGIMP.png';
import './MenuPage.css';

const PIX_KEY = "suachavepix@email.com"; 

// Função auxiliar para data local no formato YYYY-MM-DD (evita bug de UTC após 21h)
const getTodayLocalDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Aplica a máscara DD/MM/AAAA enquanto digita
const maskDateBR = (value) => {
  return value
    .replace(/\D/g, '') // Remove o que não for número
    .replace(/(\d{2})(\d)/, '$1/$2') // Adiciona a primeira barra
    .replace(/(\d{2})\/(\d{2})(\d)/, '$1/$2/$3') // Adiciona a segunda barra
    .replace(/(\d{2}\/\d{2}\/\d{4})\d+?$/, '$1'); // Limita a 10 caracteres
};

// Converte DD/MM/AAAA para YYYY-MM-DD para salvar no backend
const convertBRToISO = (brDate) => {
  if (brDate.length === 10) {
    const [day, month, year] = brDate.split('/');
    return `${year}-${month}-${day}`;
  }
  return brDate;
};

export default function StudentMenu() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false); // MOVIDO PARA DENTRO DO COMPONENTE
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

  // ESTADOS DO PAINEL DO RESPONSÁVEL (CONTROLE PARENTAL)
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showParentModal, setShowParentModal] = useState(false);

  // INICIALIZAÇÃO IMEDIATA DO CACHE LOCAL DE BLOQUEIOS
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

  // Converte datas para o formato brasileiro DD/MM/YYYY com segurança
  const formatDateBR = (dateString) => {
    if (!dateString) return '';

    // Remove horário caso venha em formato ISO (T) ou com espaço
    const cleanDate = String(dateString).split('T')[0].split(' ')[0];

    // Se já estiver no formato YYYY-MM-DD (ex: 2026-08-14)
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      const [year, month, day] = cleanDate.split('-');
      return `${day}/${month}/${year}`;
    }

    // Se já estiver no formato DD/MM/YYYY (ex: 14/08/2026)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanDate)) {
      return cleanDate;
    }

    return cleanDate;
  };

  // ESTADOS DE DATA (pickupDate salva no backend | dateInputText exibe na tela)
  const [pickupDate, setPickupDate] = useState(getTodayLocalDate());
  const [dateInputText, setDateInputText] = useState(() => {
    const [y, m, d] = getTodayLocalDate().split('-');
    return `${d}/${m}/${y}`;
  });

  const [pickupTime, setPickupTime] = useState('Manhã');
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [toasts, setToasts] = useState([]);

  const categories = ['Todos', 'Salgados', 'Lanches', 'Bebidas', 'Doces'];

  // CARREGAMENTO INICIAL DO USUÁRIO E DADOS
  useEffect(() => {
    let currentId = null;
    const savedUser = localStorage.getItem('user');

    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setStudentName(user.name || '');
        setStudentEmail(user.email || '');
        setStudentId(user.id);
        currentId = user.id;

        const savedAvatar = localStorage.getItem(`userAvatar_${user.id}`);
        if (savedAvatar) {
          setAvatarUrl(savedAvatar);
        } else if (user.avatar) {
          setAvatarUrl(user.avatar);
        }

        loadStudentBalance(user.id);
        loadBlockedProducts(user.id);
      } catch (err) {
        console.error('Erro ao ler usuário local:', err);
      }
    }

    loadProducts();
    loadStudentOrders();

    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    const interval = setInterval(() => {
      loadProducts();
      loadStudentOrders();
      if (currentId) {
        loadStudentBalance(currentId);
        loadBlockedProducts(currentId);
      }
    }, 30000);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearInterval(interval);
    };
  }, []);

  const loadStudentBalance = async (idToUse) => {
    const id = idToUse || studentId;
    if (!id) return;
    try {
      const res = await api.get(`/wallet/${id}`);
      setBalance(res.data.user?.balance || 0);
    } catch (err) {
      console.error('Erro ao buscar saldo:', err);
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
      } catch (e) {}
    }

    try {
      const token = localStorage.getItem('token');
      const res = await api.get(`/parent/blocked/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (Array.isArray(res.data) && res.data.length > 0) {
        const normalizedIds = res.data.map((item) => {
          const rawId = typeof item === 'object' && item !== null
            ? (item.productId || item.product_id || item.id)
            : item;
          return Number(rawId);
        }).filter((n) => !isNaN(n));

        setBlockedProductIds(normalizedIds);
        localStorage.setItem(`blockedProducts_${id}`, JSON.stringify(normalizedIds));
        
        // Remove itens recém-bloqueados do carrinho
        setCart((prevCart) => prevCart.filter((item) => !normalizedIds.includes(Number(item.id))));
      }
    } catch (err) {
      console.warn('Backend offline ou em sincronização. Mantendo bloqueios salvos no dispositivo.');
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
    setLoadingOrders(true);
    try {
      const token = localStorage.getItem('token');
      const res = await api.get('/orders/my-orders', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        params: { _: Date.now() }
      });
      setMyOrders(res.data || []);
    } catch (err) {
      console.error('Erro ao buscar histórico de pedidos:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

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
          const token = localStorage.getItem('token');
          await api.put('/auth/avatar', { userId: studentId, avatar: imageBase64 }, {
            headers: { Authorization: `Bearer ${token}` }
          });
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
      const token = localStorage.getItem('token');
      await api.post(
        '/parent/toggle-block',
        {
          studentId: Number(studentId),
          productId: numId,
          student_id: Number(studentId),
          product_id: numId
        },
        { headers: { Authorization: `Bearer ${token}` } }
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

  const formatMoney = (value) => {
    return Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
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

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      await api.post(
        '/orders',
        {
          student_name: studentName,
          pickup_date: pickupDate,
          pickup_time: pickupTime,
          items: cart.map((item) => ({
            id: item.id,
            quantity: item.quantity
          }))
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showToast('Pedido agendado com sucesso! 🎉');
      setCart([]);
      loadStudentOrders();
      loadStudentBalance(studentId);
    } catch (err) {
      showToast(
        err.response?.data?.error || 'Erro ao processar o pedido.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPixKey = () => {
    navigator.clipboard.writeText(PIX_KEY);
    showToast('Chave PIX copiada para a área de transferência!');
  };

  return (
    <div className="page-wrapper">
      {/* TOASTS FIXADOS NO TOPO */}
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
      <header className="adventist-header">
        <div className="brand-section">
          <img src={logoAdventista} alt="Educação Adventista" className="logo-adventista-header" />
          <div className="school-info">
            <span className="school-name">Colégio Adventista</span>
            <span className="school-location">Cantina Escolar</span>
          </div>
        </div>

        <nav className="header-navigation">
          <div className="cantina-badge-logo">
            <img src={logoGostosoSabor} alt="Gostoso Sabor" />
          </div>

          <button
            type="button"
            className="btn-header-parent"
            onClick={() => setShowPinModal(true)}
          >
            🛡️ Área dos Pais
          </button>

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
                    setShowPinModal(true);
                  }}
                >
                  👨‍👩‍👧 Área do Responsável
                </button>

                <div className="user-dropdown-divider" />

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
              {/* CARD DE SALDO */}
              <div className="wallet-badge">
                <div>
                  <span className="wallet-label">SEU SALDO</span>
                  <strong className="wallet-amount">{formatMoney(balance)}</strong>
                </div>
                <button
                  type="button"
                  className="btn-add-balance"
                  onClick={() => setShowRechargeModal(true)}
                >
                  ➕ Adicionar Saldo
                </button>
              </div>

              {/* CARD DE ATALHO DIRETO PARA OS PAIS */}
              <div 
                className="parent-quick-card"
                onClick={() => setShowPinModal(true)}
              >
                <span className="parent-card-icon">🛡️</span>
                <div>
                  <strong className="parent-card-title">Controle dos Pais</strong>
                  <span className="parent-card-subtitle">Bloquear alimentos</span>
                </div>
              </div>
            </div>
          </section>

          <section className="schedule-card">
            <div className="schedule-title">
              <div>
                <h2>Quando você vai retirar?</h2>
                <p>Escolha o dia e o turno.</p>
              </div>
            </div>

            <div className="schedule-fields">
              <div className="input-group">
                <label htmlFor="pickupDate">DATA</label>
                
                {/* INPUT COM MÁSCARA PT-BR QUE FORÇA DD/MM/AAAA */}
                <input
                  id="pickupDate"
                  type="text"
                  inputMode="numeric"
                  placeholder="DD/MM/AAAA"
                  maxLength="10"
                  value={dateInputText}
                  onChange={(e) => {
                    const masked = maskDateBR(e.target.value);
                    setDateInputText(masked);
                    
                    if (masked.length === 10) {
                      setPickupDate(convertBRToISO(masked));
                    }
                  }}
                />
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

          <div className="history-card">
            <div className="cart-header">
              <h2>Meus Pedidos Realizados</h2>
            </div>

            {loadingOrders ? (
              <p>Carregando histórico...</p>
            ) : myOrders.length === 0 ? (
              <p className="empty-cart-msg">Você ainda não realizou nenhum pedido.</p>
            ) : (
              <div className="history-list">
                {myOrders.slice(0, 5).map((order) => (
                  <div key={order.id} className="history-item-card">
                    <div className="history-item-header">
                      <strong>Pedido #{order.id}</strong>
                      <span className={`status-tag ${order.status?.toLowerCase() || 'pendente'}`}>
                        {order.status || 'Confirmado'}
                      </span>
                    </div>
                    
                    <p className="history-date">
                      Retirada: {formatDateBR(order.pickup_date)} às {order.pickup_time}
                    </p>

                    <ul className="history-products">
                      {order.items?.map((item, idx) => (
                        <li key={idx} className="history-product-line">
                          <span>{item.quantity}x {item.name || item.product_name || `Produto #${item.product_id}`}</span>
                          <span>{formatMoney(item.price || item.unit_price || 0)}</span>
                        </li>
                      ))}
                    </ul>

                    <hr className="history-divider" />

                    <div className="history-total-row">
                      <span>Total:</span>
                      <span>{formatMoney(order.total_amount || order.total || order.items?.reduce((acc, i) => acc + ((i.price || i.unit_price || 0) * i.quantity), 0))}</span>
                    </div>
                  </div>
                ))}
              </div>  
            )}
          </div>
        </aside>
      </main>

      {/* BARRA FLUTUANTE DE CARRINHO NO MOBILE */}
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

      {/* MODAL DE CONFIRMAÇÃO DO PEDIDO */}
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
              {cart.map((item) => (
                <div key={item.id} className="cart-modal-item">
                  <div className="cart-modal-item-info">
                    <span className="item-name">{item.name}</span>
                    <span className="item-qty">{item.quantity}x {formatMoney(item.price)}</span>
                  </div>
                  <span className="item-subtotal">
                    {formatMoney(item.price * item.quantity)}
                  </span>
                </div>
              ))}

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
                Confirmar e Pagar ✅
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RECARGA / PIX */}
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
              Após realizar a transferência, o saldo será creditado automaticamente na conta assim que a transação for confirmada.
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
            <h3 className="modal-title">👨‍👩‍👧 Acesso do Responsável</h3>
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
                💡 Senha padrão: <strong>1234</strong>
              </p>

              <button type="submit" className="btn-checkout btn-full">
                Entrar no Painel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DA ÁREA DO RESPONSÁVEL */}
      {showParentModal && (
        <div className="modal-overlay" onClick={() => setShowParentModal(false)}>
          <div className="modal-card modal-card-lg" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-icon" onClick={() => setShowParentModal(false)}>✕</button>
            
            <h3 className="modal-title">🛡️ Controle Alimentar do Aluno</h3>
            <p className="modal-subtitle">
              Ative ou desative os alimentos para o aluno:
            </p>

            <div className="parent-product-list">
              {products.map((product) => {
                const isBlocked = blockedProductIds.map(Number).includes(Number(product.id));

                return (
                  <div
                    key={product.id}
                    className={`parent-product-item ${isBlocked ? 'blocked' : 'allowed'}`}
                  >
                    <div>
                      <strong className="parent-product-name">{product.name}</strong>
                      <p className="parent-product-category">{product.category}</p>
                    </div>

                    <button
                      type="button"
                      className={`btn-toggle-block ${isBlocked ? 'is-blocked' : 'is-allowed'}`}
                      onClick={() => handleToggleBlock(product.id)}
                    >
                      {isBlocked ? '🚫 Bloqueado' : '✅ Permitido'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}