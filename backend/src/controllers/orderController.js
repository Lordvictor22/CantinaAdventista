const db = require('../config/db');

// ==========================================================
// CRIAR PEDIDO - ALUNO
// ==========================================================
const createOrder = async (req, res) => {
  const { student_name, pickup_date, pickup_time, items } = req.body;

  console.log('========================================');
  console.log('CRIANDO PEDIDO');
  console.log('REQ.USER:', req.user);
  console.log('USER ID:', req.user?.id);
  console.log('BODY:', req.body);
  console.log('========================================');

  // O ID vem exclusivamente do JWT
  const userId = req.user?.id;

  if (!userId) {
    console.error('❌ PEDIDO SEM USER_ID!');
    return res.status(401).json({
      error: 'Usuário não autenticado. ID do usuário não encontrado no token.'
    });
  }

  if (
    !student_name ||
    !pickup_date ||
    !pickup_time ||
    !items ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return res.status(400).json({
      error: 'Preencha todos os campos obrigatórios.'
    });
  }

  try {
    // ======================================================
    // 1. BUSCAR OS PREÇOS ATUAIS DOS PRODUTOS
    // ======================================================
    const productIds = items.map((item) => item.id);

    const productsRes = await db.query(
      `SELECT id, price
       FROM products
       WHERE id = ANY($1::bigint[])`,
      [productIds]
    );

    if (productsRes.rows.length === 0) {
      return res.status(400).json({
        error: 'Nenhum produto válido foi encontrado.'
      });
    }

    // ======================================================
    // 2. MAPEAR PREÇOS
    // ======================================================
    let total = 0;
    const priceMap = {};

    productsRes.rows.forEach((product) => {
      priceMap[product.id] = Number(product.price);
    });

    for (const item of items) {
      const itemPrice = priceMap[item.id];

      if (itemPrice === undefined) {
        return res.status(400).json({
          error: `Produto ${item.id} não foi encontrado.`
        });
      }

      if (!item.quantity || item.quantity <= 0) {
        return res.status(400).json({
          error: 'Quantidade de produto inválida.'
        });
      }

      total += itemPrice * item.quantity;
    }

    // ======================================================
    // 3. CRIAR O PEDIDO
    // ======================================================
    console.log('💾 Salvando pedido com user_id:', userId);

    const orderResult = await db.query(
      `INSERT INTO orders (
        user_id,
        student_name,
        pickup_date,
        pickup_time,
        status,
        total,
        expires_at
      )
      VALUES ($1, $2, $3::date, $4, 'pendente', $5, NULL)
      RETURNING id, user_id`,
      [
        userId,
        student_name,
        pickup_date,
        pickup_time,
        total
      ]
    );

    const orderId = orderResult.rows[0].id;
    const savedUserId = orderResult.rows[0].user_id;

    console.log('✅ PEDIDO CRIADO');
    console.log('Pedido ID:', orderId);
    console.log('User ID salvo no banco:', savedUserId);

    // ======================================================
    // 4. INSERIR OS ITENS
    // ======================================================
    for (const item of items) {
      const itemPrice = priceMap[item.id];

      await db.query(
        `INSERT INTO order_items (
          order_id,
          product_id,
          quantity,
          price
        )
        VALUES ($1, $2, $3, $4)`,
        [
          orderId,
          item.id,
          item.quantity,
          itemPrice
        ]
      );
    }

    return res.status(201).json({
      message: 'Pedido realizado com sucesso!',
      orderId
    });

  } catch (error) {
    console.error('❌ ERRO DETALHADO AO CRIAR PEDIDO:', error);

    return res.status(500).json({
      error: `Erro no banco: ${error.message}`
    });
  }
};


// ==========================================================
// BUSCAR PEDIDOS - CANTINA / CAIXA / ADMIN
// ==========================================================
const getOrders = async (req, res) => {
  try {
    const targetDate =
      req.query.date ||
      new Date().toISOString().split('T')[0];

    const queryText = `
      SELECT
        o.id,
        o.user_id,
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
      LEFT JOIN order_items oi
        ON o.id = oi.order_id
      LEFT JOIN products p
        ON oi.product_id = p.id
      WHERE o.pickup_date::date = $1::date
      GROUP BY o.id
      ORDER BY o.pickup_time ASC;
    `;

    const result = await db.query(
      queryText,
      [targetDate]
    );

    return res.json(result.rows);

  } catch (error) {
    console.error(
      'ERRO AO BUSCAR PEDIDOS:',
      error.message
    );

    return res.status(500).json({
      error: 'Erro ao carregar pedidos.'
    });
  }
};


// ==========================================================
// ATUALIZAR STATUS DO PEDIDO
// ==========================================================
const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    // Baixa do estoque quando pago ou entregue
    if (status === 'pago' || status === 'entregue') {
      const itemsRes = await db.query(
        `SELECT product_id, quantity
         FROM order_items
         WHERE order_id = $1`,
        [id]
      );

      for (const item of itemsRes.rows) {
        const prodRes = await db.query(
          `SELECT stock, name
           FROM products
           WHERE id = $1`,
          [item.product_id]
        );

        const prod = prodRes.rows[0];

        if (!prod || prod.stock < item.quantity) {
          return res.status(400).json({
            error: `Estoque insuficiente para ${
              prod ? prod.name : 'um dos itens'
            }. Restam apenas ${
              prod ? prod.stock : 0
            } unidades.`
          });
        }
      }

      for (const item of itemsRes.rows) {
        await db.query(
          `UPDATE products
           SET stock = stock - $1
           WHERE id = $2`,
          [
            item.quantity,
            item.product_id
          ]
        );
      }
    }

    // Quando fica pronto: expira em 15 minutos
    if (status === 'pronto') {
      const expirationDate =
        new Date(Date.now() + 15 * 60 * 1000);

      await db.query(
        `UPDATE orders
         SET status = $1,
             expires_at = $2
         WHERE id = $3`,
        [
          status,
          expirationDate,
          id
        ]
      );

    } else if (
      status === 'entregue' ||
      status === 'pago'
    ) {
      await db.query(
        `UPDATE orders
         SET status = $1,
             expires_at = NULL
         WHERE id = $2`,
        [
          status,
          id
        ]
      );

    } else {
      await db.query(
        `UPDATE orders
         SET status = $1
         WHERE id = $2`,
        [
          status,
          id
        ]
      );
    }

    return res.json({
      message: 'Status do pedido atualizado com sucesso!'
    });

  } catch (error) {
    console.error(
      'ERRO AO ATUALIZAR STATUS:',
      error.message
    );

    return res.status(500).json({
      error: 'Erro ao atualizar status.'
    });
  }
};


// ==========================================================
// BUSCAR SOMENTE OS PEDIDOS DO ALUNO LOGADO
// ==========================================================
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user?.id;

    console.log('========================================');
    console.log('BUSCANDO PEDIDOS DO USUÁRIO');
    console.log('REQ.USER:', req.user);
    console.log('USER ID:', userId);
    console.log('========================================');

    if (!userId) {
      return res.status(401).json({
        error: 'Usuário não autenticado.'
      });
    }

    const queryText = `
      SELECT
        o.id,
        o.user_id,
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
      LEFT JOIN order_items oi
        ON o.id = oi.order_id
      LEFT JOIN products p
        ON oi.product_id = p.id

      WHERE o.user_id = $1

      GROUP BY
        o.id,
        o.user_id,
        o.student_name,
        o.pickup_date,
        o.pickup_time,
        o.status,
        o.total

      ORDER BY o.id DESC;
    `;

    const result = await db.query(
      queryText,
      [userId]
    );

    console.log(
      'PEDIDOS RETORNADOS:',
      result.rows
    );

    return res.json(result.rows);

  } catch (error) {
    console.error(
      'ERRO AO BUSCAR PEDIDOS DO ALUNO:',
      error.message
    );

    return res.status(500).json({
      error: 'Erro ao carregar seus pedidos.'
    });
  }
};


module.exports = {
  createOrder,
  getOrders,
  updateOrderStatus,
  getUserOrders
};