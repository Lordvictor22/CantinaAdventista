import React, { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import logoAdventista from '../../assets/logoAdventistaCentenario.png';
import styles from './KitchenPanel.module.css';

const CATEGORIES = ['Todos', 'Salgados', 'Lanches', 'Bebidas', 'Doces', 'Opções Saudáveis'];

const INITIAL_FORM_STATE = {
  name: '',
  description: '',
  price: '',
  stock: '',
  category: 'Salgados',
  available: true,
  image_url: ''
};

export default function CanteenDashboard() {
  const [activeSection, setActiveSection] = useState('preparo');
  
  // Orders State
  const [orders, setOrders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  // Products State
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('Todos');
  const [productForm, setProductForm] = useState(INITIAL_FORM_STATE);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Load Orders
  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await api.get(`/orders?date=${selectedDate}`);
      setOrders(res.data);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    } finally {
      setLoadingOrders(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (activeSection !== 'preparo') return;
    loadOrders();
    
    // Atualiza a cada 15 segundos para pegar novos pedidos e expirações do robô
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, [activeSection, loadOrders]);

  // Load Products
  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      alert('Não foi possível carregar os produtos.');
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'produtos') {
      loadProducts();
    }
  }, [activeSection, loadProducts]);

  // Order Handlers
  const updateOrderStatus = async (orderId, status) => {
    if (updatingOrderId !== null) return;
    try {
      setUpdatingOrderId(orderId);
      await api.patch(`/orders/${orderId}/status`, { status });
      setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status } : o)));
    } catch (error) {
      console.error('Erro ao atualizar pedido:', error);
      alert(error.response?.data?.error || 'Não foi possível atualizar o status do pedido.');
      loadOrders();
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Upload de Imagem para o Cloudinary via Backend
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      setUploadingImage(true);
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setProductForm(prev => ({ ...prev, image_url: res.data.imageUrl }));
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      alert('Falha ao enviar a foto. Tente novamente.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Product Form Handlers
  const handleProductInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProductForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const openCreateProduct = () => {
    setEditingProduct(null);
    setProductForm(INITIAL_FORM_STATE);
    setShowProductForm(true);
  };

  const openEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price ?? '',
      stock: product.stock ?? '',
      category: product.category || 'Salgados',
      available: product.available !== false,
      image_url: product.image_url || ''
    });
    setShowProductForm(true);
  };

  const closeProductForm = () => {
    setShowProductForm(false);
    setEditingProduct(null);
  };

  const handleSaveProduct = async (event) => {
    event.preventDefault();
    if (!productForm.name.trim()) return alert('Digite o nome do produto.');
    if (productForm.price === '' || Number(productForm.price) < 0) return alert('Digite um preço válido.');

    const payload = {
      name: productForm.name.trim(),
      description: productForm.description.trim(),
      price: Number(productForm.price),
      stock: productForm.stock === '' ? 0 : Number(productForm.stock),
      category: productForm.category,
      available: productForm.available,
      image_url: productForm.image_url
    };

    try {
      if (editingProduct) {
        const res = await api.put(`/products/${editingProduct.id}`, payload);
        const updatedProduct = res.data.product || res.data;
        
        setProducts(prev => prev.map(p => 
          p.id === editingProduct.id 
            ? { ...p, ...payload, ...updatedProduct, image_url: payload.image_url } 
            : p
        ));
      } else {
        const res = await api.post('/products', payload);
        const newProduct = res.data.product || res.data;
        setProducts(prev => [...prev, { ...payload, ...newProduct }]);
      }
      closeProductForm();
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      alert(error.response?.data?.error || 'Não foi possível salvar o produto.');
    }
  };

  const toggleProductAvailability = async (product) => {
    try {
      const res = await api.patch(`/products/${product.id}`, { available: !product.available });
      setProducts(prev => prev.map(p => (p.id === product.id ? res.data.product : p)));
    } catch (error) {
      console.error('Erro ao alterar disponibilidade:', error);
      alert(error.response?.data?.error || 'Não foi possível alterar a disponibilidade.');
    }
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Tem certeza que deseja excluir "${product.name}"?`)) return;
    try {
      await api.delete(`/products/${product.id}`);
      setProducts(prev => prev.filter(p => p.id !== product.id));
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      alert(error.response?.data?.error || 'Não foi possível excluir o produto.');
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name?.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCategory = productCategory === 'Todos' || product.category === productCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className={styles.kitchenWrapper}>
      <header className={styles.kitchenHeader}>
        <div className={styles.kitchenBrand}>
          <img src={logoAdventista} alt="Colégio Adventista" />
          <div className={styles.kitchenTitles}>
            <h1>Gestão da Cantina</h1>
            <p>Caixa / Preparo / Produtos</p>
          </div>
        </div>

        <div className={styles.canteenNavigation}>
          <button
            className={`${styles.canteenNavBtn} ${activeSection === 'preparo' ? styles.active : ''}`}
            onClick={() => setActiveSection('preparo')}
          >
            👨‍🍳 Preparo
          </button>
          <button
            className={`${styles.canteenNavBtn} ${activeSection === 'produtos' ? styles.active : ''}`}
            onClick={() => setActiveSection('produtos')}
          >
            🍔 Produtos
          </button>
        </div>
      </header>

      {/* SECTION: PREPARO */}
      {activeSection === 'preparo' && (
        <main className={styles.kitchenContainer}>
          <div className={styles.sectionToolbar}>
            <div>
              <h2 className={styles.kitchenGridTitle}>📦 Pedidos da Cantina</h2>
              <p className={styles.sectionDescription}>Acompanhe os pedidos e atualize o preparo.</p>
            </div>
            <div className={styles.kitchenFilterDate}>
              <label htmlFor="dateFilter">Data:</label>
              <input
                id="dateFilter"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>

          {loadingOrders ? (
            <div className={styles.emptyQueue}><p>Carregando pedidos...</p></div>
          ) : orders.length === 0 ? (
            <div className={styles.emptyQueue}><p>🎉 Nenhum pedido para esta data!</p></div>
          ) : (
            <div className={styles.ordersKanbanGrid}>
              {orders.map(order => (
                <div key={order.id} className={`${styles.orderCard} ${order.status === 'expirado' ? styles.orderExpired : ''}`}>
                  <div>
                    <div className={styles.orderCardHeader}>
                      <div className={styles.studentInfoBox}>
                        <h3>{order.student_name}</h3>
                        <span className={styles.orderTimeBadge}>🕒 {order.pickup_time}</span>
                      </div>
                      <span className={styles.statusBadge}>
                        {order.status === 'pendente' ? 'PENDENTE' :
                         order.status === 'em_preparo' ? 'EM PREPARO' :
                         order.status === 'pronto' ? 'PRONTO' :
                         order.status === 'entregue' ? 'ENTREGUE' :
                         order.status === 'expirado' ? 'EXPIRADO' : order.status}
                      </span>
                    </div>

                    <ul className={styles.orderItemsList}>
                      {order.items?.map((item, idx) => (
                        <li key={item.id || `${item.name}-${idx}`} className={styles.orderItemRow}>
                          <span className={styles.itemQty}>{item.quantity}x</span>
                          <span>{item.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {order.status === 'pendente' && (
                    <button
                      className={`${styles.btnMarkReady} ${styles.btnStartPreparing}`}
                      disabled={updatingOrderId === order.id}
                      onClick={() => updateOrderStatus(order.id, 'em_preparo')}
                    >
                      {updatingOrderId === order.id ? 'Atualizando...' : '👨‍🍳 Iniciar Preparo'}
                    </button>
                  )}

                  {order.status === 'em_preparo' && (
                    <button
                      className={styles.btnMarkReady}
                      disabled={updatingOrderId === order.id}
                      onClick={() => updateOrderStatus(order.id, 'pronto')}
                    >
                      {updatingOrderId === order.id ? 'Atualizando...' : '✓ Marcar como Pronto'}
                    </button>
                  )}

                  {order.status === 'pronto' && (
                    <div className={styles.orderReadyMessage}>✓ Pedido pronto — aguardando retirada no caixa.</div>
                  )}

                  {order.status === 'entregue' && (
                    <div className={styles.orderDeliveredMessage}>✓ Pedido entregue ao aluno.</div>
                  )}

                  {order.status === 'expirado' && (
                    <div style={{ color: '#dc2626', fontWeight: 'bold', textAlign: 'center', marginTop: '10px' }}>
                      ⚠️ Pedido expirado (não retirado).
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* SECTION: PRODUTOS */}
      {activeSection === 'produtos' && (
        <main className={styles.productsAdminContainer}>
          <div className={styles.productsAdminHeader}>
            <div>
              <h2>🍔 Produtos do Cardápio</h2>
              <p>Cadastre e gerencie os produtos que os alunos poderão comprar.</p>
            </div>
            <button className={styles.btnNewProduct} onClick={openCreateProduct}>
              + Cadastrar Produto
            </button>
          </div>

          <div className={styles.productsFilters}>
            <input
              type="text"
              placeholder="🔎 Buscar produto..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            <select value={productCategory} onChange={(e) => setProductCategory(e.target.value)}>
              {CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {loadingProducts ? (
            <div className={styles.emptyQueue}><p>Carregando produtos...</p></div>
          ) : filteredProducts.length === 0 ? (
            <div className={styles.emptyQueue}><p>Nenhum produto encontrado.</p></div>
          ) : (
            <div className={styles.productsAdminGrid}>
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className={`${styles.adminProductCard} ${!product.available ? styles.unavailable : ''}`}
                >
                  {product.image_url ? (
                    <div className={styles.productImageContainer}>
                      <img src={product.image_url} alt={product.name} className={styles.productThumbnail} />
                    </div>
                  ) : (
                    <div className={styles.placeholderImage}>🖼️ Sem foto</div>
                  )}

                  <div className={styles.adminProductInfo}>
                    <div className={styles.adminProductTop}>
                      <span className={styles.adminProductCategory}>{product.category}</span>
                      <span className={`${styles.productAvailability} ${product.available ? styles.available : styles.unavailable}`}>
                        {product.available ? '● Disponível' : '● Indisponível'}
                      </span>
                    </div>

                    <h3>{product.name}</h3>
                    <p>{product.description || 'Sem descrição cadastrada.'}</p>

                    <div className={styles.adminProductDetails}>
                      <strong>R$ {Number(product.price).toFixed(2)}</strong>
                      <span>Estoque: {product.stock ?? 0}</span>
                    </div>
                  </div>

                  <div className={styles.adminProductActions}>
                    <button className={styles.btnEditProduct} onClick={() => openEditProduct(product)}>✏️ Editar</button>
                    <button className={styles.btnToggleProduct} onClick={() => toggleProductAvailability(product)}>
                      {product.available ? '🔴 Desativar' : '🟢 Ativar'}
                    </button>
                    <button className={styles.btnDeleteProduct} onClick={() => handleDeleteProduct(product)}>🗑️ Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* MODAL: FORMULÁRIO DE PRODUTO */}
      {showProductForm && (
        <div className={styles.productModalOverlay} onClick={closeProductForm}>
          <div className={styles.productModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.productModalHeader}>
              <div>
                <h2>{editingProduct ? 'Editar Produto' : 'Cadastrar Produto'}</h2>
                <p>Preencha as informações do produto.</p>
              </div>
              <button className={styles.modalClose} onClick={closeProductForm}>×</button>
            </div>

            <form onSubmit={handleSaveProduct}>
              <div className={styles.productFormGroup}>
                <label>Foto do Produto</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                />
                {uploadingImage && <small style={{ color: '#0056b3' }}>Enviando imagem para a nuvem...</small>}
                {productForm.image_url && (
                  <div style={{ marginTop: '8px' }}>
                    <img 
                      src={productForm.image_url} 
                      alt="Prévia" 
                      style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px' }} 
                    />
                  </div>
                )}
              </div>

              <div className={styles.productFormGroup}>
                <label>Nome do produto *</label>
                <input
                  name="name"
                  type="text"
                  placeholder="Ex.: Suco Natural de Laranja"
                  value={productForm.name}
                  onChange={handleProductInputChange}
                  required
                />
              </div>

              <div className={styles.productFormGroup}>
                <label>Descrição</label>
                <textarea
                  name="description"
                  placeholder="Descreva o produto..."
                  value={productForm.description}
                  onChange={handleProductInputChange}
                  rows="3"
                />
              </div>

              <div className={styles.productFormRow}>
                <div className={styles.productFormGroup}>
                  <label>Preço *</label>
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={productForm.price}
                    onChange={handleProductInputChange}
                    required
                  />
                </div>

                <div className={styles.productFormGroup}>
                  <label>Estoque</label>
                  <input
                    name="stock"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={productForm.stock}
                    onChange={handleProductInputChange}
                  />
                </div>
              </div>

              <div className={styles.productFormGroup}>
                <label>Categoria</label>
                <select name="category" value={productForm.category} onChange={handleProductInputChange}>
                  <option value="Salgados">Salgados</option>
                  <option value="Lanches">Lanches</option>
                  <option value="Bebidas">Bebidas</option>
                  <option value="Doces">Doces</option>
                  <option value="Opções Saudáveis">Opções Saudáveis</option>
                </select>
              </div>

              <label className={styles.availabilityCheckbox}>
                <input
                  name="available"
                  type="checkbox"
                  checked={productForm.available}
                  onChange={handleProductInputChange}
                />
                <span>Produto disponível para os alunos</span>
              </label>

              <div className={styles.productModalActions}>
                <button type="button" className={styles.btnModalCancel} onClick={closeProductForm}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnModalSave} disabled={uploadingImage}>
                  {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}