import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import logoAdventista from '../../assets/logoAdventistaCentenario.png';
import logoGostosoSabor from '../../assets/GostososaborlogoreduzidoGIMP.png';
import './MenuPage.css';

// 💡 CONFIGURE A CHAVE PIX DA CANTINA AQUI
const PIX_KEY = "suachavepix@email.com"; 

export default function StudentMenu() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState(null);
  
  // ESTADOS DA CARTEIRA / SALDO
  const [balance, setBalance] = useState(0);
  const [showRechargeModal, setShowRechargeModal] = useState(false);

  const [pickupDate, setPickupDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [pickupTime, setPickupTime] = useState('Manhã');
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [toasts, setToasts] = useState([]);

  const categories = ['Todos', 'Salgados', 'Lanches', 'Bebidas', 'Doces'];

  useEffect(() => {
    loadProducts();
    loadStudentOrders();

    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setStudentName(user.name || '');
        setStudentId(user.id);
        loadStudentBalance(user.id);
      } catch (err) {
        console.error('Erro ao ler usuário local:', err);
      }
    }

    const interval = setInterval(() => {
      loadProducts();
      loadStudentOrders();
      if (studentId) loadStudentBalance(studentId);
    }, 30000);

    return () => clearInterval(interval);
  }, [studentId]);

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
        headers: { Authorization: `Bearer ${token}` }
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

  const filteredProducts =
    selectedCategory === 'Todos'
      ? products
      : products.filter(
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
        {
          headers: { Authorization: `Bearer ${token}` }
        }
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

      {/* CABEÇALHO */}
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
        </nav>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="menu-container">
        <div className="main-content">
          {/* SAUDAÇÃO + SALDO DA CARTEIRA */}
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

          {/* DATA E TURNO */}
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

          {/* CARDÁPIO */}
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
                        <div className="no-photo-placeholder">
                          📷 Sem foto
                        </div>
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

        {/* COLUNA LATERAL */}
        <aside id="pedido" className="sidebar">
          
          {/* NOVO PEDIDO */}
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

          {/* HISTÓRICO DE PEDIDOS */}
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

                    {/* LISTA DE PRODUTOS COM PREÇO UN/TOTAL */}
                    <ul className="history-products">
                      {order.items?.map((item, idx) => (
                        <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>{item.quantity}x {item.name || item.product_name || `Produto #${item.product_id}`}</span>
                          <span>{formatMoney(item.price || item.unit_price || 0)}</span>
                        </li>
                      ))}
                    </ul>

                    <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px dashed #eee' }} />

                    {/* VALOR TOTAL DO PEDIDO */}
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

      {/* MODAL DE RECARGA DIRETA VIA PIX (SEM TAXAS) */}
      {showRechargeModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            
            {/* Botão X para fechar o Modal */}
            <button 
              type="button"
              className="modal-close-icon"
              onClick={() => setShowRechargeModal(false)}
            >
              ✕
            </button>

            <h3 className="modal-title">📱 Recarga via PIX</h3>

            <div className="pix-container">
              <p className="pix-title">
                Transfira para a Chave PIX da Cantina:
              </p>

              <p className="pix-subtitle">
                Copie a chave abaixo para usar no app do seu banco:
              </p>

              {/* Campo de leitura da chave PIX */}
              <input
                type="text"
                readOnly
                value={PIX_KEY}
                className="pix-input-key"
              />

              {/* Botão para copiar a chave */}
              <button
                type="button"
                className="pix-copy-button"
                onClick={handleCopyPixKey}
              >
                📋 Copiar Chave PIX
              </button>

              {/* Caixa explicativa sobre o comprovante */}
              <div className="pix-info-box">
                💡 <strong>Instrução:</strong> Faça o PIX do valor desejado no banco e apresente o comprovante na cantina para a atualização do seu saldo.
              </div>

              {/* Botão de Fechar */}
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setShowRechargeModal(false)}
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