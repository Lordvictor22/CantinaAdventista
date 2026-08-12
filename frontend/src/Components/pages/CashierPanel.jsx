import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import logoAdventista from '../../assets/logoAdventistaCentenario.png';
import logoGostosoSabor from '../../assets/GostososaborlogoreduzidoGIMP.png';
import './Cashier.css';

export default function CashierPanel() {
  const [orders, setOrders] = useState([]);
  const [pickupDate, setPickupDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Guarda o ID do pedido que está sendo confirmado
  const [completingOrderId, setCompletingOrderId] = useState(null);

  useEffect(() => {
    fetchOrders();

    // Atualiza a lista a cada 15 segundos (pega novos pedidos e atualizações do robô)
    const interval = setInterval(() => {
      fetchOrders();
    }, 15000);

    return () => clearInterval(interval);
  }, [pickupDate]);

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
              src={logoAdventista}
              alt="Educação Adventista"
              className="logo-adventista"
            />
          </div>

          <div className="header-title">
            <h1>Caixa & Retirada</h1>
            <p>
              Conferência de recebimentos e entregas ao aluno
            </p>
          </div>

          <div className="brand-logo">
            <img
              src={logoGostosoSabor}
              alt="Gostoso Sabor Cantina"
              className="logo-cantina"
            />
          </div>

        </header>

        {/* FILTRO DE DATA */}
        <div className="form-card">

          <div className="form-group">

            <label>
              Data de Retirada
            </label>

            <input
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
            />

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
                          {item.quantity}x {item.name}
                        </span>

                        <strong>
                          R${' '}
                          {Number(
                            item.price * item.quantity
                          ).toFixed(2)}
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