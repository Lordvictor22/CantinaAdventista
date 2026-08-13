import React, { useState } from 'react';
import api from '../../services/api';
import './ParentWallet.css';

export default function ParentWallet() {
  const [studentEmail, setStudentEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [message, setMessage] = useState('');

  // 1. Vincular Filho pelo Email
  const handleLinkStudent = async (e) => {
    e.preventDefault();
    try {
      // Exemplo usando ID do pai fixo como 1 (depois podemos pegar do Login)
      const res = await api.post('/wallet/link', {
        parent_id: 1, 
        student_email: studentEmail
      });

      setMessage(`✅ ${res.data.message}`);
      setStudentId(res.data.student_id);
      loadWalletInfo(res.data.student_id);
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.error || 'Erro ao vincular aluno'}`);
    }
  };

  // 2. Carregar Saldo e Extrato
  const loadWalletInfo = async (id) => {
    try {
      const res = await api.get(`/wallet/${id}`);
      setBalance(res.data.user.balance);
      setTransactions(res.data.transactions);
    } catch (err) {
      console.error('Erro ao carregar carteira', err);
    }
  };

  // 3. Adicionar Saldo
  const handleAddBalance = async (valueToAdd) => {
    const value = valueToAdd || parseFloat(amount);
    if (!value || value <= 0) {
      setMessage('⚠️ Digite um valor válido para recarga.');
      return;
    }

    try {
      const res = await api.post('/wallet/add-balance', {
        student_id: studentId,
        amount: value,
        description: 'Recarga feita pelo Painel dos Pais'
      });

      setMessage(`🎉 Recarga de R$ ${value.toFixed(2)} realizada com sucesso!`);
      setAmount('');
      loadWalletInfo(studentId);
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.error || 'Erro ao recarregar'}`);
    }
  };

  return (
    <div className="wallet-container">
      <h2>💳 Painel dos Pais - Carteira do Filho</h2>

      {message && <div className="wallet-alert">{message}</div>}

      {/* SEÇÃO 1: VINCULAR FILHO */}
      <div className="wallet-card">
        <h3>1. Vincular Aluno</h3>
        <form onSubmit={handleLinkStudent} className="wallet-form">
          <input
            type="email"
            placeholder="E-mail cadastrado do seu filho"
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
            required
          />
          <button type="submit">Buscar & Vincular</button>
        </form>
      </div>

      {/* SEÇÃO 2: RECARGA E SALDO (SÓ APARECE APÓS VINCULAR) */}
      {studentId && (
        <>
          <div className="wallet-card balance-card">
            <h3>2. Saldo Atual do Aluno</h3>
            <div className="balance-display">
              R$ {balance !== null ? Number(balance).toFixed(2) : '0.00'}
            </div>

            <h4>Recarga Rápida:</h4>
            <div className="quick-buttons">
              <button onClick={() => handleAddBalance(20)}>+ R$ 20,00</button>
              <button onClick={() => handleAddBalance(50)}>+ R$ 50,00</button>
              <button onClick={() => handleAddBalance(100)}>+ R$ 100,00</button>
            </div>

            <div className="custom-recharge">
              <input
                type="number"
                placeholder="Outro valor (R$)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <button onClick={() => handleAddBalance()}>Recarregar</button>
            </div>
          </div>

          {/* SEÇÃO 3: EXTRATO */}
          <div className="wallet-card">
            <h3>3. Histórico de Gastos e Recargas</h3>
            <ul className="history-list">
              {transactions.length === 0 ? (
                <p>Nenhuma movimentação até o momento.</p>
              ) : (
                transactions.map((tx) => (
                  <li key={tx.id} className={tx.type === 'DEPOSIT' ? 'deposit' : 'purchase'}>
                    <span>{tx.description}</span>
                    <strong>
                      {tx.type === 'DEPOSIT' ? '+' : '-'} R$ {Number(tx.amount).toFixed(2)}
                    </strong>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}