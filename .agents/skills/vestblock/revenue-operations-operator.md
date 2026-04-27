# Revenue Operations Operator

Use this skill when improving VestBlock pricing, checkout, paid customer tracking, upgrade prompts, billing visibility, or revenue follow-up.

## Revenue Surfaces

- PayPal order creation: `/api/create-order`
- PayPal capture: `/api/capture-order`
- Webhook route: `/api/paypal-webhook`
- Legacy webhook route: `/api/webhook`
- PayPal API environment helper: `lib/paypal/config.ts`
- User subscription fields: `user_profiles.is_subscribed`, `paypal_order_id`
- Admin visibility: `/admin-panel` payments and paid users

## Operating Rules

- Never log PayPal secrets or full payment payloads.
- Never hardcode PayPal sandbox/live URLs in routes; use `getPaypalApiUrl()`.
- Store enough payment metadata to reconcile customers without storing sensitive card data.
- Paid-user status should be visible to admins and reflected in user access.
- Payment completion should trigger `sendNewPaidCustomerAlert()` when configured.
- Failed payment or abandoned checkout automation should avoid repeated emails in a short window.
- PayPal order creation should log `checkout_started`; lifecycle cron should create `abandoned_checkout` tasks for stale unpaid orders.
- All PayPal completion paths should use `lib/payments/paymentAutomation.ts`; do not add route-local one-off payment emails.
- Check `payments.paypal_transaction_id` before inserting payment rows so repeated provider webhooks do not duplicate payment records or paid-customer alerts.
- Capture routes should update subscription state idempotently, but only run paid-customer automation for a newly recorded payment.
- Keep `PAYPAL_ENV=sandbox` until live PayPal credentials and `PAYPAL_WEBHOOK_ID` are installed in Vercel.

## Useful Improvements

- Add a durable `payments` row for every successful capture.
- Add `payment_completed` to `admin_activity`.
- Add admin filters for paid users and recent payments.
- Add onboarding email after successful upgrade.
- Add payment status badge in user detail pages.
- Tune abandoned checkout timing and follow-up copy once real conversion data exists.

## QA Checklist

- Checkout button creates PayPal order.
- Capture endpoint updates subscription state.
- Both webhook routes record completed captures or create failure tasks.
- Admin dashboard paid-user count changes after capture.
- User sees paid tools after refresh.
- Admin alert fires without breaking checkout if email fails.
