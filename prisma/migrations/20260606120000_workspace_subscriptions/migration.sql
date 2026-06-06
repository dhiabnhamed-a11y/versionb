CREATE TABLE IF NOT EXISTS "workspace_subscriptions" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "workspace_id" VARCHAR(50) NOT NULL,
  "dodo_subscription_id" VARCHAR(255),
  "dodo_customer_id" VARCHAR(255) NOT NULL DEFAULT '',
  "billing_model" VARCHAR(20) NOT NULL,
  "interval" VARCHAR(20) NOT NULL,
  "seat_count" INTEGER NOT NULL DEFAULT 1,
  "status" VARCHAR(20) NOT NULL DEFAULT 'trialing',
  "current_period_start" TIMESTAMPTZ,
  "current_period_end" TIMESTAMPTZ,
  "cancelled_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "workspace_subscriptions_user_id_idx" ON "workspace_subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "workspace_subscriptions_dodo_subscription_id_idx" ON "workspace_subscriptions"("dodo_subscription_id");
CREATE INDEX IF NOT EXISTS "workspace_subscriptions_dodo_customer_id_idx" ON "workspace_subscriptions"("dodo_customer_id");
