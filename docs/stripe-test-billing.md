# Setra Stripe test billing

These steps create **test-only** subscriptions in a Stripe sandbox. There is no code switch that enables live payments. Do not enter real card details or copy secrets into GitHub, chat, screenshots, `NEXT_PUBLIC_*` variables, or source-controlled files.

## 1. Prepare a Stripe sandbox

1. In the [Stripe Dashboard](https://dashboard.stripe.com/sandboxes), open or create a sandbox. Use the same sandbox for the products, API key, portal, and webhook.
2. In **Product catalogue**, create one product per row below. Select **Recurring**, **AUD**, and the given interval for each Price. Use flat-rate prices, not quantity tiers. Copy the `price_...` identifiers, not the `prod_...` identifiers.

| Product | Monthly Price and variable | Annual Price and variable |
| --- | --- | --- |
| Premium | 8.99 · `STRIPE_PRICE_PREMIUM_MONTH` | 79.99 · `STRIPE_PRICE_PREMIUM_YEAR` |
| Adaptive | 19.99 · `STRIPE_PRICE_ADAPTIVE_MONTH` | 179.99 · `STRIPE_PRICE_ADAPTIVE_YEAR` |
| Coach Starter, 5 seats | 29.99 · `STRIPE_PRICE_COACH_STARTER_MONTH` | Not offered |
| Coach, 20 seats | 59.99 · `STRIPE_PRICE_COACH_MONTH` | Not offered |
| Coach Pro, 50 seats | 99.99 · `STRIPE_PRICE_COACH_PRO_MONTH` | Not offered |

3. In the sandbox API keys screen, copy the server secret beginning `sk_test_` into `STRIPE_SECRET_KEY` in your local `.env.local` (not `.env.example`). Copy the seven price values into their listed variables. Set `SETRA_BILLING_ORIGIN=http://localhost:3000`.
4. With Node 22 and project dependencies installed, run:

   ```sh
   node --env-file=.env.local --experimental-strip-types scripts/configure-stripe-test-portals.ts
   ```

   Copy the two printed lines, `STRIPE_PORTAL_INDIVIDUAL=bpc_...` and `STRIPE_PORTAL_COACHING=bpc_...`, into `.env.local`. The script validates prices and creates separate test portal configurations for each family. They permit price changes, end-of-period cancel/reactivate, payment method changes and invoices. The portal displays applicable prorations and charges before confirming. This configuration allows plan/interval changes immediately; it does not promise an end-of-period downgrade. Free is reached by canceling the individual subscription.

5. Leave the existing `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) in place on the server. It is used by the billing API and verified webhook, not the browser.

## 2. Apply Supabase changes

Apply `20261127000400_add_test_billing.sql` to your test database via your normal migration workflow. It follows the Adaptive plan-adjustments migration. It creates private billing tables and a webhook journal, exposes only the signed-in user’s summary, and adds transactional seat checks. Existing individual profiles and legacy roles are preserved.

Optional, **only on the testing database after Stripe is configured**: require a coaching subscription for new coaches:

```sql
update public.billing_policy set coach_subscription_required = true where singleton;
```

Until this switch is enabled, the existing coaching setup remains available for non-billed accounts. Paid accounts are always seat-limited. Coaches grandfathered before the migration keep a non-billed workspace unless they take a coaching subscription. To grant a new non-billed test coach, a trusted database admin can insert that user’s UUID in `billing_beta_coaches`; then have them enable coaching in Setra. Paid history is still governed by the purchased capacity. Do not use profile writes to simulate Stripe payments.

## 3. Connect webhooks and test locally

1. Install the [Stripe CLI](https://docs.stripe.com/cli/install). Authenticate in the same sandbox as your Price IDs (`stripe login`; select or supply the same sandbox’s test key).
2. Start the forwarder:

   ```sh
   stripe listen --forward-to localhost:3000/api/billing/webhook \
     --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.subscription.paused,customer.subscription.resumed,invoice.paid,invoice.payment_failed,invoice.payment_action_required
   ```

   Copy the forwarder’s `whsec_...` into `STRIPE_WEBHOOK_SECRET` in `.env.local`. The CLI signing secret is not the Dashboard webhook’s signing secret. Restart `pnpm dev` after editing environment variables.
3. Sign in to Setra using a test user. In **Premium → Individual subscriptions**, choose Monthly or Annual, then Test checkout. Use [Stripe’s test cards](https://docs.stripe.com/testing), for example `4242 4242 4242 4242` with a future expiry and any three-digit CVC. After returning, check the verified status. Return alone does not grant anything. For a declined checkout use Stripe’s generic decline test card `4000 0000 0000 0002`.
4. In **Manage subscription and invoices**, switch Premium/Adaptive, change interval, schedule cancellation and reactivate before the period ends. In Stripe, verify an invoice and its associated subscription. To simulate renewals or expiry without waiting, use a dedicated sandbox with [Stripe test clocks](https://docs.stripe.com/billing/testing/test-clocks). To simulate a failed renewal, use Stripe’s test payment method that attaches successfully but then fails collection; see the declined-payments section of the test-cards guide. A synthetic event for an unrelated Stripe customer will not change Setra access.
5. In **Coaching**, buy a separate coaching plan. Invite test clients, fill the purchased capacity including pending invites, decline or cancel an invitation and verify the seat becomes available. Check that a downgrade below current use leaves all relationships and workouts in place. Explicitly fund one client, then test how cancellation, failure, ending the relationship, and a separate athlete subscription affect access.

## 4. Test a Vercel deployment

1. Use a stable HTTPS test deployment and test Supabase database. Set the same server-only Stripe values, but change `SETRA_BILLING_ORIGIN` to that deployment’s exact origin. Do not configure different Stripe sandboxes against the same Setra billing database.
2. In Stripe Workbench → Webhooks, create a **Snapshot** event destination in the sandbox for `https://YOUR-TEST-DOMAIN/api/billing/webhook`. Enable the event types shown above. Use its own revealed signing secret for that Vercel environment and redeploy. Ensure Stripe can reach the webhook; deployment protection must not intercept that endpoint.
3. Run the same Checkout and Portal tests over HTTPS. Check Stripe’s delivery view for acknowledgements. Resend an event and check that it does not duplicate access; resend an older event and check it reconciles the latest state. No scheduler is needed.

## Access rules and live launch blockers

- Active Stripe access requires a paid current invoice (or an eligible trial) and an unexpired period. Unpaid, overdue, paused, incomplete, conflicting or unmapped subscriptions do not fund access. Cancellation at period end preserves a paid period; expired periods stop granting access even if a webhook is delayed.
- Effective individual access is the highest of the manual profile grant, the paid individual plan, and an explicitly allocated coach-funded Premium grant. Coaching is billed through its own Stripe customer. Paid coach cancellations and downgrades never end relationships or choose clients to remove. When over capacity, paid funding and new assignments/invites pause until the coach restores capacity or chooses which client relationships to end. Clients keep all personal access and training.
- Update provisional amounts and seat limits in `lib/billing/catalogue.ts`. Actual Stripe Price shapes/amounts must match. Don’t remove a Price mapping still in use; support both generations before rotating prices. This initial release treats unexpected/duplicate Stripe products as action-required.
- **Before live launch:** complete real sandbox checkout, portal changes, renewal failure/retry, cancellations and concurrent invite scenarios; verify pricing/tax, cancellation and customer terms, monitoring and replay/reconciliation, support/refunds, account-deletion handling for open Stripe agreements, migrations, and separation of live customer data. Review how a live migration will handle provisional pricing and beta accounts. Live keys and live objects are refused by this implementation; opening live payments requires a separate reviewed deployment.
