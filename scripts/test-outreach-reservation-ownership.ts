import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const migration = read('supabase/migrations/20260915141718_create_outreach_throughput_governor.sql')
const governor = read('lib/outreach/throughputGovernor.ts')
const deliveryGate = read('lib/outreach/deliveryGate.ts')
const packetDelivery = read('lib/buyers/packetDelivery.ts')
const buyerRepository = read('lib/buyers/repository.ts')

assert.match(migration, /reservation_token UUID NOT NULL DEFAULT gen_random_uuid\(\)/)
assert.match(migration, /owner_lease_expires_at TIMESTAMPTZ NOT NULL/)
assert.match(migration, /p_reservation_token UUID/)
assert.match(migration, /v_existing\.owner_lease_expires_at > v_now/)
assert.match(migration, /'detail', 'reservation_owned_by_active_attempt'/)
assert.match(migration, /SET reservation_token = p_reservation_token,/)
assert.match(migration, /reservationOwnershipRecoveredAt/)

const ownerRetry = migration.slice(
  migration.indexOf("'idempotent_reserved_attempt_owner_retry'"),
  migration.indexOf("'detail', 'reservation_owned_by_active_attempt'")
)
assert.match(ownerRetry, /'cancellableByOwner', FALSE/)

const ownerTakeover = migration.slice(
  migration.indexOf("'idempotent_reserved_attempt_owner_takeover'"),
  migration.indexOf("IF v_reuse_cancelled")
)
assert.match(ownerTakeover, /'cancellableByOwner', FALSE/)

const newReservation = migration.slice(
  migration.indexOf("'globalRemaining', GREATEST(0, v_authoritative_global_limit"),
  migration.indexOf('CREATE OR REPLACE FUNCTION record_outreach_throughput_outcome')
)
assert.match(newReservation, /'cancellableByOwner', TRUE/)

const cancellationGuard = migration.slice(
  migration.indexOf("IF p_state = 'cancelled'"),
  migration.indexOf('IF v_previous.state = p_state')
)
assert.match(cancellationGuard, /p_reservation_token IS NULL/)
assert.match(cancellationGuard, /p_reservation_token <> v_previous\.reservation_token/)
assert.match(cancellationGuard, /outreach_reservation_not_owned/)

assert.match(governor, /const reservationToken = randomUUID\(\)/)
assert.match(governor, /p_reservation_token: reservationToken/)
assert.match(governor, /const allowed = result\.allowed === true && ownsReservation/)
assert.match(governor, /cancellableByOwner: result\.cancellableByOwner === true/)
assert.match(governor, /p_reservation_token: input\.reservationToken \|\| null/)

// Regression: a recovered/ambiguous reservation may own the retry lease but
// must remain counted when the legacy permit denies that retry.
assert.match(
  deliveryGate,
  /!permit\.allowed &&[\s\S]*throughput\.reservationId &&[\s\S]*throughput\.reservationToken &&[\s\S]*throughput\.cancellableByOwner/
)
assert.match(deliveryGate, /reservationToken: throughput\.reservationToken,[\s\S]*state: 'cancelled'/)
assert.match(
  deliveryGate,
  /reservationToken: attempt\.throughput\.reservationToken,[\s\S]*state: outcome === 'accepted' \? 'accepted' : 'failed'/
)

assert.match(migration, /CREATE OR REPLACE FUNCTION claim_buyer_packet_send/)
assert.match(migration, /buyer_packet_send_claimed_by_active_attempt/)
assert.match(migration, /send_claim_token IS DISTINCT FROM p_claim_token/)
assert.match(buyerRepository, /admin\.rpc\('claim_buyer_packet_send'/)
assert.match(buyerRepository, /\.eq\('send_claim_token', claimToken\)/)

const packetLoop = packetDelivery.slice(packetDelivery.indexOf('for (const match of rows as any[])'))
assert.ok(
  packetLoop.indexOf('claimBuyerPacketSend({') < packetLoop.indexOf('sendBuyerPacketEmail({'),
  'buyer packet delivery must atomically claim the buyer/packet pair before the provider call'
)
assert.match(packetLoop, /finalizeQueuedBuyerPacketSend\(queuedSend\.id, claimToken,/)

console.log('Outreach reservation ownership and buyer-packet concurrency tests passed.')
