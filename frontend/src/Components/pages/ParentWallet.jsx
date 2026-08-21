import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './ParentWallet.css';

export default function ParentWallet() {
  const navigate = useNavigate();

  // Estados dos Filhos
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Estados da Carteira e Painel do Filho
  const [balance, setBalance] = useState(null);
  const [dailyLimit, setDailyLimitState] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState('');
  const [studentEmail, setStudentEmail] = useState('');

  // Estados de Interface e Modais
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 1. Busca os filhos vinculados ao pai logado
  const fetchLinkedStudents = async () => {
    try {
      const res = await api.get('/wallet/my-students');
      const list = res.data || [];
      setStudents(list);

      if (list.length > 0) {
        handleSelectStudent(list[0]);
      } else {
        setShowLinkForm(true);
      }
    } catch (err) {
      console.error('Erro ao buscar alunos vinculados:', err);
    }
  };

  useEffect(() => {
    fetchLinkedStudents();
  }, []);

  // 2. Carrega todas as informações do filho selecionado (Saldo, Limite, Extrato)
  const loadStudentDetails = async (studentId) => {
    try {
      setLoading(true);
      const resWallet = await api.get(`/wallet/${studentId}`);
      setBalance(resWallet.data.user?.balance ?? 0);
      setTransactions(resWallet.data.transactions || []);

      // Busca dados extras como limite diário
      const resSummary = await api.get(`/wallet/student/${studentId}/summary`);
      if (resSummary.data) {
        setDailyLimitState(resSummary.data.dailyLimit || '');
      }
    } catch (err) {
      console.error('Erro ao carregar dados do aluno:', err);
      setMessage(`❌ ${err.response?.data?.error || 'Erro ao carregar dados do aluno'}`);
    } finally {
      setLoading(false);
    }
  };

  // Alterna o filho selecionado
  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setMessage('');
    loadStudentDetails(student.id);
  };

  // Vincular novo filho
  const handleLinkStudent = async (e) => {
    e.preventDefault();
    if (!studentEmail.trim()) {
      setMessage('⚠️ Digite o e-mail do aluno.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const res = await api.post('/wallet/link', {
        student_email: studentEmail.trim().toLowerCase()
      });

      setMessage(`✅ ${res.data.message}`);
      setStudentEmail('');
      setShowLinkForm(false);
      await fetchLinkedStudents();
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.error || 'Erro ao vincular aluno'}`);
    } finally {
      setLoading(false);
    }
  };

  // Adicionar Saldo
  const handleAddBalance = async (valueToAdd) => {
    if (!selectedStudent) return;
    const value = valueToAdd || parseFloat(amount);

    if (!value || value <= 0) {
      setMessage('⚠️ Digite um valor válido para recarga.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/wallet/add-balance', {
        student_id: selectedStudent.id,
        amount: value,
        description: 'Recarga feita pelo Painel dos Pais'
      });

      setMessage(`🎉 ${res.data.message || `Recarga de R$ ${value.toFixed(2)} realizada!`}`);
      setAmount('');
      await loadStudentDetails(selectedStudent.id);
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.error || 'Erro ao recarregar'}`);
    } finally {
      setLoading(false);
    }
  };

  // Definir Limite Diário de Gastos do Filho
  const handleSaveDailyLimit = async () => {
    if (!selectedStudent) return;

    setLoading(true);
    try {
      await api.put(`/wallet/student/${selectedStudent.id}/daily-limit`, {
        dailyLimit: parseFloat(dailyLimit) || 0
      });
      setMessage('✅ Limite diário atualizado com sucesso!');
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.error || 'Erro ao salvar limite diário'}`);
    } finally {
      setLoading(false);
    }
  };

  // Confirmar Exclusão de Conta do Pai
  const confirmDeleteAccount = async () => {
    setShowDeleteModal(false);
    try {
      setLoading(true);
      await api.delete('/wallet/account');
      alert('Sua conta foi excluída com sucesso.');
      localStorage.clear();
      navigate('/login');
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.error || 'Erro ao excluir conta.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="wallet-container">
      {/* BARRA SUPERIOR (TOPBAR) */}
      <div className="wallet-topbar">
        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#333' }}>
          🏫 GOSTOSO SABOR - Painel do Responsável
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            disabled={loading}
            style={{
              backgroundColor: '#ffebee',
              color: '#d32f2f',
              border: '1px solid #ef5350',
              padding: '8px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            🗑️ Excluir Minha Conta
          </button>

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            Sair ↪
          </button>
        </div>
      </div>

      {/* CABEÇALHO */}
      <div className="wallet-header">
        <div className="wallet-icon">💳</div>
        <div>
          <h2>Gestão dos Filhos</h2>
          <p className="wallet-subtitle">
            Gerencie recargas, limites de consumo e extratos.
          </p>
        </div>
      </div>

      {message && <div className="wallet-alert">{message}</div>}

      {/* SELEÇÃO DE FILHOS */}
      {students.length > 0 && (
        <div className="wallet-card">
          <h3>Seus Filhos Cadastrados</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
            {students.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => handleSelectStudent(st)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '20px',
                  border: selectedStudent?.id === st.id ? '2px solid #d32f2f' : '1px solid #ccc',
                  backgroundColor: selectedStudent?.id === st.id ? '#ffebee' : '#fff',
                  fontWeight: selectedStudent?.id === st.id ? 'bold' : 'normal',
                  cursor: 'pointer'
                }}
              >
                👤 {st.name || st.email}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowLinkForm(!showLinkForm)}
              style={{
                padding: '10px 18px',
                borderRadius: '20px',
                border: '1px dashed #666',
                backgroundColor: '#f9f9f9',
                cursor: 'pointer'
              }}
            >
              {showLinkForm ? '✕ Fechar' : '+ Vincular outro filho'}
            </button>
          </div>
        </div>
      )}

      {/* FORMULÁRIO DE VÍNCULO */}
      {(showLinkForm || students.length === 0) && (
        <div className="wallet-card">
          <h3>Vincular Novo Filho</h3>
          <form onSubmit={handleLinkStudent} className="wallet-form">
            <input
              type="email"
              placeholder="E-mail do aluno cadastrado no sistema"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Aguarde...' : 'Vincular Filho'}
            </button>
          </form>
        </div>
      )}

      {/* PAINEL DE CONTROLE DO FILHO SELEÇÃO */}
      {selectedStudent && (
        <>
          {/* SALDO E RECARGAS */}
          <div className="wallet-card balance-card">
            <h3>Carteira de {selectedStudent.name || selectedStudent.email}</h3>

            <div className="balance-display">
              R$ {balance !== null ? Number(balance).toFixed(2) : '0.00'}
            </div>

            <h4>Recarga Rápida</h4>
            <div className="quick-buttons">
              <button type="button" disabled={loading} onClick={() => handleAddBalance(20)}>
                + R$ 20,00
              </button>
              <button type="button" disabled={loading} onClick={() => handleAddBalance(50)}>
                + R$ 50,00
              </button>
              <button type="button" disabled={loading} onClick={() => handleAddBalance(100)}>
                + R$ 100,00
              </button>
            </div>

            <div className="custom-recharge">
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Outro valor (R$)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <button type="button" disabled={loading} onClick={() => handleAddBalance()}>
                {loading ? 'Processando...' : 'Recarregar'}
              </button>
            </div>
          </div>

          {/* TRAVA DE LIMITE DIÁRIO DE CONSUMO */}
          <div className="wallet-card">
            <h3>⚙️ Limite Diário de Gastos</h3>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '10px' }}>
              Defina o valor máximo que este aluno pode gastar por dia na cantina.
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="number"
                step="0.50"
                placeholder="Valor diário (ex: 15.00)"
                value={dailyLimit}
                onChange={(e) => setDailyLimitState(e.target.value)}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
              <button
                type="button"
                onClick={handleSaveDailyLimit}
                disabled={loading}
                style={{
                  backgroundColor: '#2e7d32',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Salvar Limite
              </button>
            </div>
          </div>

          {/* HISTÓRICO DE CONSUMO */}
          <div className="wallet-card">
            <h3>📊 Extrato de Gastos e Recargas</h3>

            {transactions.length === 0 ? (
              <p className="empty-history">Nenhuma movimentação registrada.</p>
            ) : (
              <ul className="history-list">
                {transactions.map((tx) => (
                  <li
                    key={tx.id}
                    className={tx.type === 'DEPOSIT' ? 'deposit' : 'purchase'}
                  >
                    <span>{tx.description}</span>
                    <strong>
                      {tx.type === 'DEPOSIT' ? '+' : '-'} R$ {Number(tx.amount).toFixed(2)}
                    </strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-icon">⚠️</span>
              <h3>Confirmar Exclusão de Conta</h3>
            </div>

            <p className="modal-body">
              Tem certeza que deseja apagar sua conta? Esta ação é <strong>irreversível</strong>.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-confirm-delete"
                onClick={confirmDeleteAccount}
                disabled={loading}
              >
                {loading ? 'Excluindo...' : 'Sim, Excluir Minha Conta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}