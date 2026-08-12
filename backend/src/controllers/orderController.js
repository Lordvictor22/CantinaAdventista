const db = require('../config/db');

// Criar pedido (Aluno) - expires_at inicia como NULL
const createOrder = async (req, res) => {
  const { student_name, pickup_date, pickup_time, items } = req.body;

  if (!student_name || !pickup_date || !pickup_time || !items || items.length === 0) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  try {
    // 1. Busca os preços atualizados dos produtos
    const productIds = items.map((i) => i.id);
    const productsRes = await db.query(
      `SELECT id, price FROM products WHERE id = ANY($1::int[])`,
      [productIds]
    );

    let total = 0;
    const priceMap = {};
    productsRes.rows.forEach((p) => {
      priceMap[p.id] = Number(p.price);
    });

    items.forEach((item) => {
      const itemPrice = priceMap[item.id] || 0;
      total += itemPrice * item.quantity;
    });

    // 2. Salva o pedido com status 'pendente' e expires_at NULL (contagem não iniciada)
    const orderResult = await db.query(
      `INSERT INTO orders (student_name, pickup_date, pickup_time, status, total, expires_at)
       VALUES ($1, $2::date, $3, 'pendente', $4, NULL)
       RETURNING id`,
      [student_name, pickup_date, pickup_time, total]
    );

    const orderId = orderResult.rows[0].id;

    // 3. Insere os itens do pedido
    for (const item of items) {
      const itemPrice = priceMap[item.id] || 0;
      await db.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.id, item.quantity, itemPrice]
      );
    }

    return res.status(201).json({
      message: 'Pedido realizado com sucesso!',
      orderId
    });
  } catch (error) {
    console.error('ERRO DETALHADO AO CRIAR PEDIDO:', error.message);
    return res.status(500).json({ error: `Erro no banco: ${error.message}` });
  }
};

// Buscar pedidos para a cantina/caixa
const getOrders = async (req, res) => {
  try {
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];

    const queryText = `
      SELECT 
        o.id, 
        o.student_name, 
        TO_CHAR(o.pickup_date, 'YYYY-MM-DD') AS pickup_date, 
        o.pickup_time, 
        o.status,
        o.total,
        o.expires_at,
        json_agg(
          json_build_object(
            'id', p.id,
            'name', p.name,
            'quantity', oi.quantity,
            'price', oi.price
          )
        ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.pickup_date::date = $1::date
      GROUP BY o.id
      ORDER BY o.pickup_time ASC;
    `;

    const result = await db.query(queryText, [targetDate]);
    return res.json(result.rows);
  } catch (error) {
    console.error('ERRO AO BUSCAR PEDIDOS:', error.message);
    return res.status(500).json({ error: 'Erro ao carregar pedidos.' });
  }
};

// Atualizar status do pedido (Gera a baixa no estoque e calcula a expiração de 15 min ao ficar "pronto")
const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    // 1. Se o pedido for marcado como "pago" ou "entregue", faz a baixa real no estoque
    if (status === 'pago' || status === 'entregue') {
      const itemsRes = await db.query(
        `SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
        [id]
      );

      for (const item of itemsRes.rows) {
        const prodRes = await db.query(`SELECT stock, name FROM products WHERE id = $1`, [item.product_id]);
        const prod = prodRes.rows[0];

        if (!prod || prod.stock < item.quantity) {
          return res.status(400).json({
            error: `Estoque insuficiente para ${prod ? prod.name : 'um dos itens'}. Restam apenas ${prod ? prod.stock : 0} unidades.`
          });
        }
      }

      for (const item of itemsRes.rows) {
        await db.query(
          `UPDATE products SET stock = stock - $1 WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }
    }

    // 2. Lógica para definir expires_at exatamente no momento em que fica PRONTO
    if (status === 'pronto') {
      const expirationDate = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos a partir de AGORA
      await db.query(
        'UPDATE orders SET status = $1, expires_at = $2 WHERE id = $3',
        [status, expirationDate, id]
      );
    } else if (status === 'entregue' || status === 'pago') {
      // Limpa a expiração se for entregue antes do prazo
      await db.query(
        'UPDATE orders SET status = $1, expires_at = NULL WHERE id = $2',
        [status, id]
      );
    } else {
      // Para 'pendente' ou 'em_preparo'
      await db.query(
        'UPDATE orders SET status = $1 WHERE id = $2',
        [status, id]
      );
    }

    return res.json({ message: 'Status do pedido atualizado com sucesso!' });
  } catch (error) {
    console.error('ERRO AO ATUALIZAR STATUS:', error.message);
    return res.status(500).json({ error: 'Erro ao atualizar status.' });
  }
};

// Buscar histórico de pedidos do aluno logado
const getUserOrders = async (req, res) => {
  try {
    const studentName = req.query.student_name;

    let queryText = `
      SELECT 
        o.id, 
        o.student_name, 
        TO_CHAR(o.pickup_date, 'YYYY-MM-DD') AS pickup_date, 
        o.pickup_time, 
        o.status,
        o.total,
        json_agg(
          json_build_object(
            'id', p.id,
            'name', p.name,
            'quantity', oi.quantity,
            'price', oi.price
          )
        ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
    `;

    const queryParams = [];

    if (studentName) {
      queryText += ` WHERE o.student_name = $1`;
      queryParams.push(studentName);
    }

    queryText += `
      GROUP BY o.id
      ORDER BY o.id DESC;
    `;

    const result = await db.query(queryText, queryParams);
    return res.json(result.rows);
  } catch (error) {
    console.error('ERRO AO BUSCAR HISTÓRICO DO ALUNO:', error.message);
    return res.status(500).json({ error: 'Erro ao carregar histórico.' });
  }
};

module.exports = { createOrder, getOrders, updateOrderStatus, getUserOrders };