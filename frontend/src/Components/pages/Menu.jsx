import { useState, useEffect } from 'react';
import api from '../../services/api';
import './MenuPage.css';

// Importando as imagens das marcas (certifique-se que estão na pasta src/assets)
import logoAdventista from '../../assets/logoAdventistaCentenario.png';
import logoGostosoSabor from '../../assets/GostososaborlogoreduzidoGIMP.png';

export default function StudentMenu() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [studentName, setStudentName] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('1º Recreio (09:30)');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const calculateTotal = () => {
    return cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  };

  const handleCheckout = async () => {
    if (!studentName || !pickupDate) {
      alert('Por favor, preencha o nome do aluno e a data de retirada.');
      return;
    }

    try {
      await api.post('/orders', {
        student_name: studentName,
        pickup_date: pickupDate,
        pickup_time: pickupTime,
        items: cart,
        total: calculateTotal(),
      });

      alert('Pedido realizado com sucesso!');
      setCart([]);
      setStudentName('');
    } catch (err) {
      console.error('Erro ao finalizar pedido:', err);
      alert('Falha ao enviar o pedido.');
    }
  };

  return (
    <div className="menu-container">
      {/* topo com as duas logos */}
      <header className="menu-header">
        <img src={logoAdventista} alt="Educação Adventista" className="logo-header" />
        <div className="header-title">
          <h1>Cardápio Escolar</h1>
          <p>Pedidos Online - Cantina Escolar</p>
        </div>
        <img src={logoGostosoSabor} alt="Gostoso Sabor Cantina" className="logo-header" />
      </header>

      {/* Dados do Aluno */}
      <section className="form-card">
        <div className="form-group">
          <label>Nome do Aluno</label>
          <input
            type="text"
            placeholder="Nome completo do aluno"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Data de Retirada</label>
          <input
            type="date"
            value={pickupDate}
            onChange={(e) => setPickupDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Horário / Recreio</label>
          <select
            value={pickupTime}
            onChange={(e) => setPickupTime(e.target.value)}
          >
            <option value="1º Recreio (09:30)">1º Recreio (09:30)</option>
            <option value="2º Recreio (15:30)">2º Recreio (15:30)</option>
            <option value="Almoço">Almoço</option>
          </select>
        </div>
      </section>

      {/* Grid de Produtos */}
      <section className="products-section">
        {loading ? (
          <p className="loading-text">Carregando cardápio...</p>
        ) : (
          <div className="products-grid">
            {products.map((prod) => (
              <div key={prod.id} className="product-card">
                <div className="product-info">
                  <h3>{prod.name}</h3>
                  <span className="product-category">{prod.category}</span>
                </div>
                <div className="product-footer">
                  <span className="price">R$ {Number(prod.price).toFixed(2)}</span>
                  <button onClick={() => addToCart(prod)} className="btn-add">
                    Adicionar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Resumo do Carrinho */}
      <section className="cart-card">
        <h2>Seu Carrinho</h2>
        {cart.length === 0 ? (
          <p className="cart-empty">Nenhum item adicionado.</p>
        ) : (
          <ul className="cart-items">
            {cart.map((item) => (
              <li key={item.id}>
                <span>{item.quantity}x {item.name}</span>
                <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="cart-total-row">
          <span>Total:</span>
          <strong>R$ {calculateTotal().toFixed(2)}</strong>
        </div>

        <button
          onClick={handleCheckout}
          disabled={cart.length === 0}
          className="btn-submit"
        >
          Finalizar Pedido
        </button>
      </section>
    </div>
  );
}