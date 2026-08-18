import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import logoAdventista from '../../assets/logoAdventistaCentenario.png';
import logoGostosoSabor from '../../assets/GostososaborlogoreduzidoGIMP.png';
import './Cashier.css';

export default function CashierPanel() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  // Guarda a data em ISO (YYYY-MM-DD) mas expõe selects dia/mês/ano para evitar confusão com localizações
  // Use local date to avoid UTC timezone shifts
  const getTodayLocalDate = () => {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const initialISO = getTodayLocalDate();
  const [pickupDate, setPickupDate] = useState(initialISO);
  const [pickupDay, setPickupDay] = useState(() => initialISO.split('-')[2]);
  const [pickupMonth, setPickupMonth] = useState(() => initialISO.split('-')[1]);
  const [pickupYear, setPickupYear] = useState(() => initialISO.split('-')[0]);

  // Logout do painel do caixa
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const monthsBR = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const monthNamesBR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  const daysInMonth = (year, month) => {
    return new Date(Number(year), Number(month), 0).getDate();
  };

  const updatePickupISO = (y,m,d) => {
    const iso = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    setPickupDate(iso);
  };

  // Guarda o ID do pedido que está sendo confirmado
  const [completingOrderId, setCompletingOrderId] = useState(null);

  useEffect(() => {
    fetchOrders();

    // Atualiza a lista a cada 15 segundos (pega novos pedidos e atualizações do robô)
    const interval = setInterval(() => {
      fetchOrders();
    }, 15000);

    return () => clearInterval(interval);
  }, [pickupDate, pickupDay, pickupMonth, pickupYear]);

  // Quando os selects mudam, compõe o ISO e dispara fetch
  useEffect(() => {
    updatePickupISO(pickupYear, pickupMonth, pickupDay);
  }, [pickupDay, pickupMonth, pickupYear]);

  const fetchOrders = async () => {
    try {
      const res = await api.get(`/orders?date=${pickupDate}`);
      setOrders(res.data);
    } catch (err) {
      console.error('Erro ao buscar pedidos:', err);
    }
  };

  const handleCompleteOrder = async (id) => {
    // Evita enviar a mesma requisição duas vezes
    if (completingOrderId !== null) {
      return;
    }

    try {
      setCompletingOrderId(id);

      // Dispara a atualização de status e a baixa no estoque
      await api.patch(`/orders/${id}/status`, {
        status: 'entregue'
      });

      // Recarrega a lista para manter o estoque e status sincronizados
      await fetchOrders();

    } catch (err) {
      console.error('Erro ao finalizar entrega:', err);

      alert(
        err.response?.data?.error ||
        'Não foi possível confirmar a entrega do pedido.'
      );
      fetchOrders();
    } finally {
      setCompletingOrderId(null);
    }
  };

  const getStatusBadgeText = (status) => {
    switch (status) {
      case 'entregue':
        return 'ENTREGUE';
      case 'pago':
        return 'PAGO';
      case 'expirado':
        return 'EXPIRADO';
      default:
        return 'PENDENTE';
    }
  };

  return (
    <div className="page-wrapper">

      {/* NAVBAR */}
      <nav className="top-navbar">
        <ul className="top-navbar-links">
          <li>
            <a href="#caixa">Caixa & Atendimento</a>
          </li>
          <li>
            <button className="orders-link" onClick={() => navigate('/canteen')} title="Voltar para a Cantina">← Voltar à Cantina</button>
          </li>
          <li>
            <button className="btn-logout-small" onClick={handleLogout} title="Sair do painel">Sair</button>
          </li>
        </ul>

        <span className="portal-badge">
          Módulo Financeiro
        </span>
      </nav>

      {/* CONTEÚDO */}
      <main className="menu-container">

        {/* CABEÇALHO */}
        <header className="menu-header">

          <div className="brand-logo">
            <img
              src={logoGostosoSabor}
              alt="Gostoso Sabor"
              className="logo-adventista logo-gostoso"
            />
          </div>
 
          <div className="header-title">
            <h1>Caixa & Retirada</h1>
            <p>
              Conferência de recebimentos e entregas ao aluno
            </p>
          </div>

        </header>

        {/* FILTRO DE DATA */}
        <div className="form-card">

          <div className="form-group">

            <label>
              Data de Retirada
            </label>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={pickupDay} onChange={(e) => setPickupDay(e.target.value)}>
                {Array.from({ length: daysInMonth(pickupYear, pickupMonth) }, (_, i) => i + 1).map(d => (
                  <option key={d} value={String(d).padStart(2,'0')}>{String(d).padStart(2,'0')}</option>
                ))}
              </select>

              <select value={pickupMonth} onChange={(e) => setPickupMonth(e.target.value)}>
                {monthsBR.map((m, idx) => (
                  <option key={m} value={m}>{monthNamesBR[idx]} ({m})</option>
                ))}
              </select>

              <select value={pickupYear} onChange={(e) => setPickupYear(e.target.value)}>
                {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() + i).map(y => (
                  <option key={y} value={String(y)}>{String(y)}</option>
                ))}
              </select>

            </div>

          </div>

        </div>

        {/* PEDIDOS */}
        {orders.length === 0 ? (

          <div className="form-card empty-orders-card">
            <p className="empty-cart">
              Nenhum pedido registrado para esta data.
            </p>
          </div>

        ) : (

          <div className="orders-grid">

            {orders.map((order) => (

              <div
                key={order.id}
                className={`order-card ${
                  order.status === 'entregue'
                    ? 'order-completed'
                    : order.status === 'expirado'
                    ? 'order-expired'
                    : ''
                }`}
              >

                <div>

                  {/* CABEÇALHO DO PEDIDO */}
                  <div className="order-header">

                    <div>

                      <div className="order-student-name">
                        {order.student_name}
                      </div>

                      <div className="order-meta">
                        Recreio: {order.pickup_time}
                      </div>

                    </div>

                    <span
                      className={`badge-status badge-${order.status}`}
                    >
                      {getStatusBadgeText(order.status)}
                    </span>

                  </div>

                  {/* ITENS */}
                  <ul className="order-items-list">

                    {order.items?.map((item, idx) => (

                      <li key={idx}>

                        <span>
                          {Number(item.quantity) || 1}x {item.product_name || item.name || `Item #${item.product_id || idx}`}
                        </span>

                        <strong>
                          R${' '}
                          {Number((item.price || item.unit_price || 0) * (item.quantity || 1)).toFixed(2)}
                        </strong>

                      </li>

                    ))}

                  </ul>

                  {/* TOTAL */}
                  <div
                    className="cart-summary"
                    style={{ margin: '12px 0' }}
                  >

                    <span>
                      Total Pedido:
                    </span>

                    <strong>
                      R${' '}
                      {Number(
                        order.total || 0
                      ).toFixed(2)}
                    </strong>

                  </div>

                </div>

                {/* BOTÃO CONFIRMAR (APENAS PARA PEDIDOS PENDENTES OU PAGOS) */}
                {order.status !== 'entregue' && order.status !== 'expirado' && (

                  <button
                    className="btn-action-success"
                    onClick={() => handleCompleteOrder(order.id)}
                    disabled={completingOrderId === order.id}
                  >

                    {completingOrderId === order.id ? (
                      <>
                        <span className="button-spinner"></span>
                        Confirmando...
                      </>
                    ) : (
                      <>
                        ✓ Confirmar Entrega
                      </>
                    )}

                  </button>

                )}

                {/* PEDIDO JÁ ENTREGUE */}
                {order.status === 'entregue' && (

                  <div className="delivery-confirmed">

                    <span className="delivery-check">
                      ✓
                    </span>

                    <span>
                      Pedido entregue
                    </span>

                  </div>

                )}

                {/* PEDIDO EXPIRADO */}
                {order.status === 'expirado' && (

                  <div className="delivery-expired" style={{ color: '#dc2626', fontWeight: 'bold', textAlign: 'center', marginTop: '10px' }}>

                    <span>
                      ⚠️ Pedido expirado (não retirado)
                    </span>

                  </div>

                )}

              </div>

            ))}

          </div>

        )}

      </main>
    </div>
  );
}