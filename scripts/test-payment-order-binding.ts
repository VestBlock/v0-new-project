import assert from 'node:assert/strict';

import {
  buildPaypalCustomId,
  parsePaypalCustomId,
  verifyPaypalCapture,
  verifyPaypalOrderBinding,
} from '../lib/payments/paypalOrderBinding';

const userId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';

const fundingCustomId = buildPaypalCustomId({
  productType: 'funding_strategy_review',
  userId,
  requestId,
});
assert.deepEqual(parsePaypalCustomId(fundingCustomId), {
  version: 'vb2',
  productType: 'funding_strategy_review',
  userId,
  requestId,
});

const order = {
  id: 'PAYPAL-ORDER-1',
  status: 'APPROVED',
  purchase_units: [
    {
      custom_id: fundingCustomId,
      amount: { currency_code: 'USD', value: '300.00' },
    },
  ],
};
const verified = verifyPaypalOrderBinding(order, userId);
assert.equal(verified.product.type, 'funding_strategy_review');

assert.throws(
  () => verifyPaypalOrderBinding(order, '33333333-3333-4333-8333-333333333333'),
  /different account/
);
assert.throws(
  () =>
    verifyPaypalOrderBinding(
      {
        ...order,
        purchase_units: [
          { ...order.purchase_units[0], amount: { currency_code: 'USD', value: '75.00' } },
        ],
      },
      userId
    ),
  /amount does not match/
);
assert.equal(parsePaypalCustomId('funding_strategy_review:guest:none'), null);

const capture = verifyPaypalCapture(
  {
    purchase_units: [
      {
        payments: {
          captures: [
            {
              id: 'CAPTURE-1',
              status: 'COMPLETED',
              amount: { currency_code: 'USD', value: '300.00' },
            },
          ],
        },
      },
    ],
  },
  verified.product
);
assert.equal(capture.transactionId, 'CAPTURE-1');
assert.equal(capture.amount, '300.00');

assert.throws(
  () =>
    verifyPaypalCapture(
      {
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: 'CAPTURE-2',
                  status: 'COMPLETED',
                  amount: { currency_code: 'USD', value: '75.00' },
                },
              ],
            },
          },
        ],
      },
      verified.product
    ),
  /amount does not match/
);

console.log('PayPal order binding tests passed.');
