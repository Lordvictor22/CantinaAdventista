Compliance & deployment notes

1) Migrations
- There is a migration SQL (001_create_audit_and_webhook_tables.sql) recommended to create logs, webhook_events and recharges tables. If you use a migration framework, convert the SQL into your migration format.

2) Webhook HMAC
- To enable HMAC verification for the PIX webhook, set MP_WEBHOOK_SECRET in your environment (.env) to the secret provided by your payment provider.
- The server attempts to use the raw request body to compute HMAC-SHA256(rawBody) and compare with header 'x-mercadopago-signature' (or 'x-mp-signature' / 'x-signature').
- If signature verification fails, the event is recorded in webhook_events as unprocessed for manual review.

3) Retention
- Logs and webhook_events are purged after 6 months by a scheduled job in server.js. Keep off-site backups if required.

4) Estorno
- Refunds are allowed automatically within REFUND_WINDOW_HOURS (default 48). Set REFUND_WINDOW_HOURS in .env to adjust.

5) LGPD notes
- The API returns sanitized orders (no personal contact info) and stores minimal details in logs. Legal review is recommended for policies on data access and deletion for minors.

6) Next steps
- Apply the migration SQL in the backend/migrations folder (if present) or run equivalent statements manually.
- Provide MP_WEBHOOK_SECRET if you want to enable strict HMAC verification and test with provider sandbox.
