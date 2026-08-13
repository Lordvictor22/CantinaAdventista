const express = require('express');
const router = express.Router();
const { MercadoPagoConfig, Payment } = require('mercadopago');
const db = require('../config/db');

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const payment = new Payment(client);

// 1. GERAR QR CODE PIX
router.post('/create-pix', async (req, res) => {
  const { student_id, amount, email } = req.body;

  if (!student_id || !amount) {
    return res.status(400).json({ error: 'Faltam dados obrigatórios.' });
  }

  try {
    const response = await payment.create({
      body: {
        transaction_amount: Number(amount),
        description: `Recarga de Saldo - Aluno #${student_id}`,
        payment_method_id: 'pix',
        payer: {
          email: email || 'cliente@email.com'
        },
        external_reference: String(student_id) // Guarda o ID do aluno
      }
    });

    return res.json({
      payment_id: response.id,
      qr_code: response.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64
    });

  } catch (error) {
    console.error('Erro ao gerar PIX:', error);
    return res.status(500).json({ error: 'Erro ao gerar cobrança PIX.' });
  }
});

// 2. WEBHOOK (AVISO AUTOMÁTICO DE PAGAMENTO)
router.post('/webhook', async (req, res) => {
  const { type, data } = req.body;

  try {
    if (type === 'payment') {
      const paymentInfo = await payment.get({ id: data.id });

      if (paymentInfo.status === 'approved') {
        const studentId = paymentInfo.external_reference;
        const valorPago = paymentInfo.transaction_amount;

        // Adiciona o valor no saldo do aluno no BD
        await db.query(
          'UPDATE users SET balance = COALESCE(balance, 0) + $1 WHERE id = $2',
          [valorPago, studentId]
        );
        console.log(`[PIX PAGO] R$ ${valorPago} adicionados ao aluno #${studentId}`);
      }
    }
  } catch (err) {
    console.error('Erro no Webhook:', err);
  }

  return res.sendStatus(200);
});

module.exports = router;