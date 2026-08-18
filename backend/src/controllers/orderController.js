const db = require('../config/db');

/**
 * Converte entradas de data variadas (DD/MM/YYYY, dias da semana, "hoje", "amanhã")
 * para o formato aceito pelo banco de dados PostgreSQL (YYYY-MM-DD).
 */
const parseDate = (dateStr) => {
  if (!dateStr) return null;

  const input = String(dateStr).trim().toLowerCase();

  // 1. Caso já venha no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  // 2. Caso venha no formato brasileiro DD/MM/YYYY
  if (input.includes('/')) {
    const [day, month, year] = input.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const today = new Date();

  // 3. Casos relativos: "hoje" e "amanhã"
  if (input === 'hoje') {
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (input === 'amanhã' || input === 'amanha') {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 4. Dias da semana (ex: "terça", "segunda-feira")
  const daysMap = {
    'domingo': 0, 'dom': 0,
    'segunda': 1, 'segunda-feira': 1, 'seg': 1,
    'terça': 2, 'terca': 2, 'terça-feira': 2, 'terca-feira': 2, 'ter': 2,
    'quarta': 3, 'quarta-feira': 3, 'qua': 3,
    'quinta': 4, 'quinta-feira': 4, 'qui': 4,
    'sexta': 5, 'sexta-feira': 5, 'sex': 5,
    'sábado': 6, 'sabado': 6, 'sab': 6
  };

  const targetDay = daysMap[input];

  if (targetDay !== undefined) {
    const currentDay = today.getDay();
    let diff = targetDay - currentDay;

    if (diff <= 0) diff += 7;

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  return input;
};

// 1. Criar Novo Pedido com Validação de Saldo, Limite Diário e Transação
const createOrder = async (req, res) => {
  const studentNameInput = req.body.student_name || req.body.studentName;
  const pickupDateInput = req.body.pickup_date || req.body.pickupDate;
  const pickupTimeInput = req.body.pickup_time || req.body.pickupTime || req.body.shift;
  const items = req.body.items;

  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }

  if (!pickupDateInput || !pickupTimeInput || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Preencha a data, o turno/horário e selecione ao menos um item.' });
  }

  const pickup_date = parseDate(pickupDateInput);
  const pickup_time = pickupTimeInput;

  const client = await db.connect();

  try {
    await client.query('BEGIN'); // Inicia a Transação SQL

    // Buscar dados do aluno (Nome, Saldo e Limite Diário)
    const userRes = await client.query(
      'SELECT id, name, balance, daily_limit FROM users WHERE id = $1 FOR UPDATE', 
      [userId]
    );

    const user = userRes.rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aluno não encontrado.' });
    }
    console.log('========== DEBUG LIMITE ==========');
    console.log('Aluno:', user.name);
    console.log('ID:', user.id);
    console.log('Limite diário:', user.daily_limit);
    console.log('Saldo:', user.balance);
    console.log('==================================');

    const student_name = studentNameInput || user.name;
    const productIds = items.map((item) => item.id || item.product_id);

    // Checagem de produtos bloqueados pelos pais
    const blockedCheck = await client.query(
      `SELECT p.name 
       FROM student_blocked_products bp
       JOIN products p ON bp.product_id = p.id
       WHERE bp.student_id = $1 AND bp.product_id = ANY($2::bigint[])`,
      [userId, productIds]
    ).catch(async () => {
      return await client.query(
        `SELECT p.name 
         FROM blocked_products bp
         JOIN products p ON bp.product_id = p.id
         WHERE bp.student_id = $1 AND bp.product_id = ANY($2::bigint[])`,
        [userId, productIds]
      );
    });

    if (blockedCheck && blockedCheck.rows.length > 0) {
      const blockedNames = blockedCheck.rows.map(r => r.name).join(', ');
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Pedido recusado: O(s) produto(s) [${blockedNames}] foram bloqueados pelos seus responsáveis.`
      });
    }

    // Buscar preços atualizados e estoque dos produtos
    const productsRes = await client.query(
      `SELECT id, name, price, stock FROM products WHERE id = ANY($1::bigint[]) FOR UPDATE`,
      [productIds]
    );

    const productMap = {};
    productsRes.rows.forEach((prod) => {
      productMap[prod.id] = prod;
    });

    let total = 0;
    for (const item of items) {
      const prodId = item.id || item.product_id;
      const prod = productMap[prodId];

      if (!prod || !item.quantity || item.quantity <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Produto inválido ou indisponível.` });
      }

      if (prod.stock !== null && prod.stock !== undefined && prod.stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Estoque insuficiente para o produto: ${prod.name}` });
      }

      total += Number(prod.price) * item.quantity;
    }

    total = Math.round(total * 100) / 100;

    // 1. Verificar Saldo
    if (Number(user.balance) < total) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Saldo insuficiente. Saldo atual: R$ ${Number(user.balance).toFixed(2)}, Valor do pedido: R$ ${total.toFixed(2)}` 
      });
    }

    // 2. Verificar Limite Diário (Ajustado para Fuso Horário Local 'America/Sao_Paulo')
    if (user.daily_limit !== null && user.daily_limit !== undefined) {
      const dailyLimitVal = Number(user.daily_limit);

      if (dailyLimitVal > 0) {
        const spentTodayRes = await client.query(
          `SELECT COALESCE(SUM(total), 0) AS spent 
           FROM orders 
           WHERE user_id = $1 
             AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date 
             AND status NOT IN ('cancelado', 'estornado', 'CANCELLED')`,
          [userId]
        );
        
        const spentToday = Number(spentTodayRes.rows[0].spent);
        const projectedSpent = spentToday + total;

        if (projectedSpent > dailyLimitVal) {
          await client.query('ROLLBACK');
          const remaining = Math.max(0, dailyLimitVal - spentToday);

          return res.status(400).json({
            error: `O valor excede o limite diário de R$ ${dailyLimitVal.toFixed(2)}. Você já gastou R$ ${spentToday.toFixed(2)} hoje. Limite restante: R$ ${remaining.toFixed(2)}.`
          });
        }
      }
    }

    // Debitar o saldo do aluno
    await client.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [total, userId]
    );

    // Baixa no estoque dos produtos
    for (const item of items) {
      const prodId = item.id || item.product_id;
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock IS NOT NULL',
        [item.quantity, prodId]
      );
    }

    // Registrar movimentação na tabela de transações
    await client.query(
      `INSERT INTO transactions (user_id, amount, type, description)
       VALUES ($1, $2, 'PURCHASE', $3)`,
      [userId, -total, `Compra na cantina - Retirada em ${pickup_date}`]
    );

    // Inserir o Pedido
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, student_name, pickup_date, pickup_time, status, total)
       VALUES ($1, $2, $3::date, $4, 'pago', $5)
       RETURNING id`,
      [userId, student_name, pickup_date, pickup_time, total]
    );

    const orderId = orderResult.rows[0].id;

    for (const item of items) {
      const prodId = item.id || item.product_id;
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [orderId, prodId, item.quantity, productMap[prodId].price]
      );
    }

    await client.query('COMMIT');

    // Log de auditoria
    try {
      await client.query(
        `INSERT INTO logs (user_id, action, details) VALUES ($1, $2, $3)`,
        [userId, 'CREATE_ORDER', `order_id=${orderId} total=${total}`]
      );
    } catch (logErr) {
      console.warn('Não foi possível registrar log de pedido:', logErr.message || logErr);
    }

    return res.status(201).json({
      message: 'Pedido realizado e pago com sucesso!',
      orderId
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ ERRO AO CRIAR PEDIDO:', error);
    return res.status(500).json({ error: 'Erro interno ao processar pedido.' });
  } finally {
    client.release();
  }
};

// 2. Buscar Pedidos do Usuário Logado
const getUserOrders = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await db.query(
      `SELECT o.id, o.student_name, o.pickup_date, o.pickup_time, o.status, o.total, o.created_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', oi.id,
                    'product_id', oi.product_id,
                    'quantity', oi.quantity,
                    'price', oi.price,
                    'product_name', p.name
                  )
                ) FILTER (WHERE oi.id IS NOT NULL), '[]'
              ) AS items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [userId]
    );

    const sanitized = result.rows.map(r => ({
      id: r.id,
      student_name: r.student_name,
      pickup_date: r.pickup_date,
      pickup_time: r.pickup_time,
      status: r.status,
      total: r.total,
      created_at: r.created_at,
      items: r.items || []
    }));

    return res.json(sanitized);
  } catch (error) {
    console.error('❌ ERRO AO BUSCAR PEDIDOS DO USUÁRIO:', error);
    return res.status(500).json({ error: 'Erro ao buscar históricos de pedidos.' });
  }
};

// 2b. Estorno / Reembolso de pedido
const refundOrder = async (req, res) => {
  const orderId = Number(req.params.id);
  const requesterId = req.user.id;
  const isAdmin = !!req.user.is_admin;

  if (!orderId) return res.status(400).json({ error: 'ID de pedido inválido.' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT id, user_id, total, status, created_at FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    const order = orderRes.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    if (!isAdmin && order.user_id !== requesterId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Sem permissão para estornar este pedido.' });
    }

    if (order.status === 'estornado' || order.status === 'cancelado') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Pedido já foi estornado ou cancelado.' });
    }

    const refundWindowHours = Number(process.env.REFUND_WINDOW_HOURS || 48);
    if (!isAdmin) {
      const createdAt = new Date(order.created_at);
      const now = new Date();
      const diffMs = now - createdAt;
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours > refundWindowHours) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Estorno somente permitido até ${refundWindowHours} horas após a compra.` });
      }
    }

    await client.query('UPDATE orders SET status = $1 WHERE id = $2', ['estornado', orderId]);
    await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [order.total, order.user_id]);

    await client.query(
      `INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, 'REFUND', $3)`,
      [order.user_id, Number(order.total), `Estorno do pedido #${orderId}`]
    );

    await client.query(
      `INSERT INTO logs (user_id, action, details) VALUES ($1, $2, $3)`,
      [requesterId, 'REFUND_ORDER', `order_id=${orderId} refunded_by=${requesterId}`]
    );

    await client.query('COMMIT');

    return res.json({ message: 'Pedido estornado com sucesso.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ ERRO AO ESTORNAR PEDIDO:', error);
    return res.status(500).json({ error: 'Erro ao processar estorno.' });
  } finally {
    client.release();
  }
};

// 3. Buscar Todos os Pedidos (Cantina / Atendimento)
const getAllOrders = async (req, res) => {
  try {
    const rawDate = req.query.date || req.query.pickup_date;
    const parsedDate = parseDate(rawDate);

    let baseQuery = `
      SELECT o.id, o.user_id, o.student_name, o.pickup_date, o.pickup_time, o.status, o.total, o.created_at,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'product_id', oi.product_id,
                   'quantity', oi.quantity,
                   'price', oi.price,
                   'product_name', p.name
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), '[]'
             ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
    `;

    const params = [];
    if (parsedDate) {
      baseQuery += ` WHERE o.pickup_date::date = $1::date `;
      params.push(parsedDate);
    }

    baseQuery += ` GROUP BY o.id ORDER BY o.pickup_date::date ASC, o.pickup_time ASC, o.created_at DESC`;

    const result = await db.query(baseQuery, params);

    return res.json(result.rows);
  } catch (error) {
    console.error('❌ ERRO AO BUSCAR TODOS OS PEDIDOS:', error);
    return res.status(500).json({ error: 'Erro ao carregar lista geral de pedidos.' });
  }
};

// 4. Atualizar Status do Pedido
const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'O novo status é obrigatório.' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const currentOrder = orderRes.rows[0];

    if (status === 'cancelado' && currentOrder.status !== 'cancelado') {
      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [currentOrder.total, currentOrder.user_id]
      );

      await client.query(
        `INSERT INTO transactions (user_id, amount, type, description)
         VALUES ($1, $2, 'REFUND', $3)`,
        [currentOrder.user_id, currentOrder.total, `Reembolso referente ao Pedido #${id} cancelado`]
      );
    }

    const updateRes = await client.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    await client.query('COMMIT');

    return res.json({
      message: 'Status do pedido atualizado com sucesso!',
      order: updateRes.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ ERRO AO ATUALIZAR STATUS:', error);
    return res.status(500).json({ error: 'Erro ao atualizar status do pedido.' });
  } finally {
    client.release();
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  refundOrder
};