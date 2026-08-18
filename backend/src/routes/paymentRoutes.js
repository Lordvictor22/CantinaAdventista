const express = require('express');
const router = express.Router();
const { MercadoPagoConfig, Payment } = require('mercadopago');
const db = require('../config/db');

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const payment = new Payment(client);
const crypto = require('crypto');

// 1. GERAR QR CODE PIX
router.post('/create-pix', async (req, res) => {
  const { student_id, amount, email } = req.body;

  if (!student_id || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Dados inválidos ou valor incorreto.' });
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
        external_reference: String(student_id)
      }
    });

    return res.json({
      payment_id: response.id,
      qr_code: response.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: response.point_of_interaction?.transaction_data?.qr_code_base64
    });

  } catch (error) {
    console.error('Erro ao gerar PIX:', error);
    return res.status(500).json({ error: 'Erro ao gerar cobrança PIX.' });
  }
});

// 2. WEBHOOK COM TRATAMENTO DE IDEMPOTÊNCIA
router.post('/webhook', async (req, res) => {
  // Captura o ID do pagamento em qualquer formato enviado pelo Mercado Pago
  const paymentId = 
    req.body?.data?.id || 
    req.body?.id || 
    req.query?.id || 
    req.query?.['data.id'];

  const type = req.body?.type || req.query?.type || req.body?.action;

  if (!paymentId) {
    return res.sendStatus(200); // Responde 200 para evitar retentativas desnecessárias
  }

  try {
    // Verificação opcional de token de webhook (MP pode enviar cabeçalho customizado)
    const configuredToken = process.env.MP_WEBHOOK_TOKEN;
    if (configuredToken) {
      const incoming = req.headers['x-mp-webhook-token'] || req.headers['x-webhook-token'] || req.headers['x-mercadopago-signature'];
      if (!incoming || String(incoming) !== String(configuredToken)) {
        console.warn('[WEBHOOK] Token de webhook ausente ou inválido. Rejeitando processamento.');
        return res.sendStatus(200); // Retorna OK para evitar retries, mas não processa
      }
    }

    // Verificação HMAC (quando configurado) - mais segura que o token simples
    const webhookSecret = process.env.MP_WEBHOOK_SECRET;
    if (webhookSecret) {
      try {
        const rawBody = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
        const computed = crypto.createHmac('sha256', String(webhookSecret)).update(rawBody).digest('hex');
        const incomingSig = (req.headers['x-mercadopago-signature'] || req.headers['x-mp-signature'] || req.headers['x-signature'] || '') + '';
        if (!incomingSig || !computed || incomingSig !== computed) {
          console.warn('[WEBHOOK] Assinatura HMAC inválida. Rejeitando processamento.');
          // Salvar evento não processado para auditoria
          try {
            await db.query('INSERT INTO webhook_events (event_id, provider, payload, signature, processed) VALUES ($1,$2,$3,$4,$5)', [paymentId ? String(paymentId) : null, 'mercadopago', rawBody, incomingSig || null, false]);
          } catch (we) {
            console.warn('Falha ao gravar webhook_events (assinatura inválida):', we.message || we);
          }
          return res.sendStatus(200);
        }
      } catch (hErr) {
        console.warn('Erro ao validar HMAC do webhook:', hErr.message || hErr);
        return res.sendStatus(200);
      }
    }

    // Filtra para processar apenas atualizações de pagamento
    if (type === 'payment' || type === 'payment.updated' || type === 'payment.created' || !type) {
      const paymentInfo = await payment.get({ id: paymentId });

      if (paymentInfo && (paymentInfo.status === 'approved' || paymentInfo.status === 'paid')) {
        const studentId = parseInt(paymentInfo.external_reference, 10);
        const valorPago = Number(paymentInfo.transaction_amount);
        const strPaymentId = String(paymentInfo.id);

        if (isNaN(studentId)) {
          console.error(`[WEBHOOK] ID do aluno inválido no external_reference: ${paymentInfo.external_reference}`);
          return res.sendStatus(200);
        }

        // Inicia Transação SQL para garantir consistência
        const clientDb = await db.connect();

        try {
          await clientDb.query('BEGIN');

          // Verifica se este pagamento já foi processado anteriormente (idempotência)
          const checkExists = await clientDb.query(
            'SELECT id FROM recharges WHERE payment_id = $1',
            [strPaymentId]
          );

          if (checkExists.rows.length === 0) {
            // 1. Atualiza o saldo do aluno
            await clientDb.query(
              'UPDATE users SET balance = COALESCE(balance, 0) + $1 WHERE id = $2',
              [valorPago, studentId]
            );

            // 2. Grava o histórico do pagamento para evitar reprocessamento
            await clientDb.query(
              'INSERT INTO recharges (payment_id, student_id, amount, status) VALUES ($1, $2, $3, $4)',
              [strPaymentId, studentId, valorPago, 'approved']
            );

            // Armazena evento do webhook para auditoria (payload + signature)
            try {
              const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
              const incomingSig = (req.headers['x-mercadopago-signature'] || req.headers['x-mp-signature'] || req.headers['x-signature'] || '') + '';
              await clientDb.query(
                'INSERT INTO webhook_events (event_id, provider, payload, signature, processed) VALUES ($1,$2,$3,$4,$5)',
                [strPaymentId, 'mercadopago', rawBody, incomingSig || null, true]
              );
            } catch (we) {
              console.warn('Falha ao gravar webhook_events (audit):', we.message || we);
            }

            // Log mínimo (não guardar dados sensíveis do pagador)
            try {
              await db.query('INSERT INTO logs (user_id, action, details) VALUES ($1, $2, $3)', [studentId, 'PIX_RECHARGE', `payment_id=${strPaymentId} amount=${valorPago}`]);
            } catch (logErr) {
              console.warn('Falha ao gravar log do webhook PIX:', logErr.message || logErr);
            }

            await clientDb.query('COMMIT');
            console.log(`[PIX APROVADO] R$ ${valorPago} creditados para o aluno #${studentId} (Payment ID: ${strPaymentId})`);
          } else {
            await clientDb.query('ROLLBACK');
            console.log(`[PIX DUPLICADO] Pagamento #${strPaymentId} já havia sido processado.`);
          }
        } catch (dbErr) {
          await clientDb.query('ROLLBACK');
          throw dbErr;
        } finally {
          clientDb.release();
        }
      }
    }
  } catch (err) {
    console.error('Erro ao processar Webhook do Mercado Pago:', err);
  }

  // Sempre retorne 200 OK para o Mercado Pago não travar a fila de webhooks
  return res.sendStatus(200);
});

module.exports = router;