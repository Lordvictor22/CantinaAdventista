import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import logoAdventista from '../../assets/logoAdventistaCentenario.png';
import logoGostosoSabor from '../../assets/GostososaborlogoreduzidoGIMP.png';
import './MenuPage.css';

const PIX_KEY = "suachavepix@email.com"; 

export default function StudentMenu() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
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
  const [blockedProductIds, setBlockedProductIds] = useState([]);

  const [pickupDate, setPickupDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [pickupTime, setPickupTime] = useState('Manhã');
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [toasts, setToasts] = useState([]);

  const categories = ['Todos', 'Salgados', 'Lanches', 'Bebidas', 'Doces'];

  // 1. CARREGAMENTO INICIAL DO USUÁRIO E DADOS RELACIONADOS
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

    // Listener para fechar o menu dropdown de usuário ao clicar fora
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    // Polling automático a cada 30s
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
    let id = idToUse || studentId;
    if (!id) {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          id = u.id;
        } catch (e) {}
      }
    }

    if (!id) return;

    try {
      const res = await api.get(`/parent/blocked/${id}`);
      if (Array.isArray(res.data)) {
        setBlockedProductIds(res.data);
      }
    } catch (err) {
      console.error('Erro ao buscar produtos bloqueados:', err);
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
    const id = Date.now();
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

  // VALIDAÇÃO DO PIN DO RESPONSÁVEL
  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === '1234') { // PIN PADRÃO: 1234
      setShowPinModal(false);
      setPinInput('');
      setShowParentModal(true);
    } else {
      showToast('PIN incorreto! Tente novamente.', 'error');
    }
  };

  // BLOQUEAR / DESBLOQUEAR PRODUTO NA ÁREA DOS PAIS
  const handleToggleBlock = async (productId) => {
    if (!studentId) return;
    try {
      const res = await api.post('/parent/toggle-block', {
        studentId,
        productId
      });

      if (res.data.isBlocked) {
        setBlockedProductIds((prev) => [...prev, productId]);
        // Remove do carrinho se o produto foi bloqueado
        setCart((prev) => prev.filter((item) => item.id !== productId));
        showToast('Alimento bloqueado para o aluno.');
      } else {
        setBlockedProductIds((prev) => prev.filter((id) => id !== productId));
        showToast('Alimento liberado!');
      }
    } catch (err) {
      showToast('Erro ao atualizar permissão do alimento.', 'error');
    }
  };

  const addToCart = (product) => {
    if (product.stock !== undefined && product.stock <= 0) {
      showToast('Produto esgotado!', 'error');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (product.stock !== undefined && existing.quantity >= product.stock) {
          showToast(`Limite do estoque atingido (${product.stock} un.).`, 'error');
          return prev;
        }
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
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
          if (item.id === id) {
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

  // FILTRA PRODUTOS QUE NÃO ESTÃO BLOQUEADOS PELO RESPONSÁVEL
  const visibleProducts = products.filter(
    (p) => !blockedProductIds.includes(p.id)
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
      {/* NOTIFICAÇÕES */}
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

      {/* CABEÇALHO */}
      <header className="adventist-header">
        <div className="brand-section">
          <img src={logoAdventista} alt="Educação Adventista" className="logo-adventista-header" />
          <div className="school-info">
            <span className="school-name">Colégio Adventista</span>
            <span className="school-location">Cantina Escolar</span>
          </div>
        </div>

        <nav className="header-navigation" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="cantina-badge-logo">
            <img src={logoGostosoSabor} alt="Gostoso Sabor" style={{ maxHeight: '38px' }} />
          </div>

          <div className="user-profile-menu" ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                background: 'none',
                border: '2px solid #fff',
                borderRadius: '50%',
                padding: '0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                width: '42px',
                height: '42px'
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Perfil"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#1d3557',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '18px'
                  }}
                >
                  {studentName ? studentName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </button>

            {showUserMenu && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '50px',
                  backgroundColor: '#ffffff',
                  color: '#333',
                  borderRadius: '8px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                  width: '230px',
                  zIndex: 1000,
                  overflow: 'hidden',
                  border: '1px solid #eee'
                }}
              >
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px', color: '#111' }}>
                    {studentName || 'Usuário'}
                  </p>
                  {studentEmail && (
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#666' }}>
                      {studentEmail}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#333'
                  }}
                >
                  📷 Alterar Foto
                </button>

                {/* OPÇÃO DE NAVEGAÇÃO DOS PAIS */}
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowPinModal(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#1d3557',
                    fontWeight: 'bold'
                  }}
                >
                  👨‍👩‍👧 Área do Responsável
                </button>

                <div style={{ borderTop: '1px solid #f0f0f0' }} />

                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#dc2626',
                    fontWeight: '500'
                  }}
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
                <input
                  id="pickupDate"
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
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
                const cartItem = cart.find((item) => item.id === product.id);
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
                      Retirada: {order.pickup_date} às {order.pickup_time}
                    </p>

                    <ul className="history-products">
                      {order.items?.map((item, idx) => (
                        <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>{item.quantity}x {item.name || item.product_name || `Produto #${item.product_id}`}</span>
                          <span>{formatMoney(item.price || item.unit_price || 0)}</span>
                        </li>
                      ))}
                    </ul>

                    <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px dashed #eee' }} />

                    <div className="history-total-row" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
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

      {/* 🔐 MODAL DE VALIDAÇÃO DE SENHA/PIN DO RESPONSÁVEL */}
      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '380px', textAlign: 'center' }}>
            <button type="button" className="modal-close-icon" onClick={() => setShowPinModal(false)}>✕</button>
            <h3 className="modal-title">👨‍👩‍👧 Acesso do Responsável</h3>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
              Digite a senha/PIN de 4 dígitos do responsável para gerenciar as permissões alimentares.
            </p>

            <form onSubmit={handlePinSubmit}>
              <input
                type="password"
                maxLength="4"
                placeholder="Ex: 1234"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '20px',
                  textAlign: 'center',
                  letterSpacing: '8px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  marginBottom: '16px'
                }}
                autoFocus
              />
              <p style={{ fontSize: '11px', color: '#888', marginBottom: '16px' }}>
                💡 Senha padrão de teste: <strong>1234</strong>
              </p>

              <button type="submit" className="btn-checkout" style={{ width: '100%' }}>
                Entrar no Painel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🛡️ MODAL DA ÁREA DO RESPONSÁVEL (CONTROLE PARENTAL) */}
      {showParentModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto' }}>
            <button type="button" className="modal-close-icon" onClick={() => setShowParentModal(false)}>✕</button>
            
            <h3 className="modal-title">🛡️ Controle Alimentar do Aluno</h3>
            <p style={{ fontSize: '14px', color: '#555', marginBottom: '20px' }}>
              Ative ou desative os alimentos que <strong>{studentName}</strong> pode visualizar e comprar na cantina:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {products.map((product) => {
                const isBlocked = blockedProductIds.includes(product.id);

                return (
                  <div
                    key={product.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: isBlocked ? '#fef2f2' : '#f8fafc',
                      border: isBlocked ? '1px solid #fecaca' : '1px solid #e2e8f0'
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block', fontSize: '15px', color: isBlocked ? '#dc2626' : '#1e293b' }}>
                        {product.name}
                      </strong>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {product.category} • {formatMoney(product.price)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleBlock(product.id)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        backgroundColor: isBlocked ? '#dc2626' : '#16a34a',
                        color: '#ffffff',
                        transition: '0.2s'
                      }}
                    >
                      {isBlocked ? '🚫 Bloqueado' : '✓ Liberado'}
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="btn-close-modal"
              onClick={() => setShowParentModal(false)}
              style={{ marginTop: '20px', width: '100%' }}
            >
              Concluir Alterações
            </button>
          </div>
        </div>
      )}

      {/* 📱 MODAL DE RECARGA DIRETA VIA PIX */}
      {showRechargeModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <button type="button" className="modal-close-icon" onClick={() => setShowRechargeModal(false)}>✕</button>
            <h3 className="modal-title">📱 Recarga via PIX</h3>

            <div className="pix-container">
              <p className="pix-title">Transfira para a Chave PIX da Cantina:</p>
              <p className="pix-subtitle">Copie a chave abaixo para usar no app do seu banco:</p>

              <input type="text" readOnly value={PIX_KEY} className="pix-input-key" />

              <button type="button" className="pix-copy-button" onClick={handleCopyPixKey}>
                📋 Copiar Chave PIX
              </button>

              <div className="pix-info-box">
                💡 <strong>Instrução:</strong> Faça o PIX do valor desejado no banco e apresente o comprovante na cantina para a atualização do seu saldo.
              </div>

              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setShowRechargeModal(false)}
                style={{ marginTop: '16px', width: '100%' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}