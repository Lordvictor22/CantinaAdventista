const db = require('../config/db');

const getProducts = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM products ORDER BY category, name');
    return res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return res.status(500).json({ error: 'Erro ao carregar cardápio.' });
  }
};

const createProduct = async (req, res) => {
  const { name, description, price, stock, category, available, image_url } = req.body;

  const numericPrice = Number(price);

  if (!name || !Number.isFinite(numericPrice) || numericPrice < 0) {
    return res.status(400).json({
      error: 'Nome e preço válido são obrigatórios.'
    });
  }

  try {
    const result = await db.query(
      `INSERT INTO products (name, description, price, stock, category, available, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        name,
        description || '',
        price,
        stock !== undefined && stock !== null ? stock : 0,
        category || 'Salgados',
        available !== undefined ? available : true,
        image_url || ''
      ]
    );

    return res.status(201).json({
      message: 'Produto cadastrado com sucesso!',
      product: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Já existe um produto com este nome.' });
    }
    console.error('Erro ao criar produto:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar produto.' });
  }
};

const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, description, price, stock, category, available, image_url } = req.body;

  try {
    // 1. Busca o produto atual para preservar dados não enviados
    const currentProductQuery = await db.query('SELECT * FROM products WHERE id = $1', [id]);

    if (currentProductQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    const currentProduct = currentProductQuery.rows[0];

    // 2. Se image_url vier vazia, indefinida ou nula, mantém a URL já existente no banco
    const finalImageUrl = (image_url && image_url.trim() !== '') 
      ? image_url 
      : currentProduct.image_url;

    // 3. Executa o UPDATE com os valores garantidos
    const result = await db.query(
      `UPDATE products 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           stock = COALESCE($4, stock),
           category = COALESCE($5, category),
           available = COALESCE($6, available),
           image_url = $7
       WHERE id = $8
       RETURNING *`,
      [
        name,
        description,
        price,
        stock,
        category,
        available,
        finalImageUrl,
        id
      ]
    );

    return res.json({ 
      message: 'Produto atualizado com sucesso!', 
      product: result.rows[0] 
    });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    return res.status(500).json({ error: 'Erro ao atualizar produto.' });
  }
};

// 🟢 NOVA FUNÇÃO: Inverte ou define o status de disponibilidade (available)
const toggleProductStatus = async (req, res) => {
  const { id } = req.params;
  const { available } = req.body; // Aceita 'available' no body se quiser forçar true/false

  try {
    let result;

    if (available !== undefined) {
      // Se passou o valor booleano explicitamente no body
      result = await db.query(
        'UPDATE products SET available = $1 WHERE id = $2 RETURNING *',
        [available, id]
      );
    } else {
      // Se não passou nada no body, simplesmente inverte o valor atual (NOT available)
      result = await db.query(
        'UPDATE products SET available = NOT available WHERE id = $1 RETURNING *',
        [id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    return res.json({
      message: `Produto ${result.rows[0].available ? 'ativado' : 'desativado'} com sucesso!`,
      product: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao alterar status do produto:', error);
    return res.status(500).json({ error: 'Erro ao alterar status do produto.' });
  }
};

const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    return res.json({ message: 'Produto removido com sucesso!' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({ 
        error: 'Não é possível excluir um produto associado a pedidos existentes. Em vez disso, altere para indisponível.' 
      });
    }
    console.error('Erro ao deletar produto:', error);
    return res.status(500).json({ error: 'Erro ao deletar produto.' });
  }
};

module.exports = { 
  getProducts, 
  createProduct, 
  updateProduct, 
  toggleProductStatus, 
  deleteProduct 
};