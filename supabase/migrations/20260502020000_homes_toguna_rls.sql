-- =====================================================================
-- TOGUNA HOME'S RLS ポリシー (Phase 1)
-- 発行日: 2026-05-02
-- 認証連携: homes_users.auth_user_id ↔ auth.users.id
-- =====================================================================

-- =====================================================================
-- helper: 現在のユーザー情報をJWTから取得 (ロール判定/team判定 高速化)
-- =====================================================================
CREATE OR REPLACE FUNCTION homes_current_user_id() RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM homes_users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION homes_current_user_role() RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM homes_users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION homes_is_admin() RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM homes_users
    WHERE auth_user_id = auth.uid() AND role IN ('ADMIN','PM','SV')
  );
$$;

-- =====================================================================
-- RLS 有効化
-- =====================================================================
ALTER TABLE homes_teams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_areas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_lists           ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_approvals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_companies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_activities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_deals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_meetings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_collections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_yomi_rates      ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- マスタ系: 認証済みなら全員 SELECT 可。書込みは ADMIN/PM のみ
-- =====================================================================
DROP POLICY IF EXISTS "homes_teams_read" ON homes_teams;
CREATE POLICY "homes_teams_read" ON homes_teams FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "homes_teams_write" ON homes_teams;
CREATE POLICY "homes_teams_write" ON homes_teams FOR ALL TO authenticated
  USING (homes_is_admin()) WITH CHECK (homes_is_admin());

DROP POLICY IF EXISTS "homes_users_read" ON homes_users;
CREATE POLICY "homes_users_read" ON homes_users FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "homes_users_self_update" ON homes_users;
CREATE POLICY "homes_users_self_update" ON homes_users FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR homes_is_admin())
  WITH CHECK (auth_user_id = auth.uid() OR homes_is_admin());
DROP POLICY IF EXISTS "homes_users_admin_write" ON homes_users;
CREATE POLICY "homes_users_admin_write" ON homes_users FOR INSERT TO authenticated
  WITH CHECK (homes_is_admin());
DROP POLICY IF EXISTS "homes_users_admin_delete" ON homes_users;
CREATE POLICY "homes_users_admin_delete" ON homes_users FOR DELETE TO authenticated
  USING (homes_is_admin());

DROP POLICY IF EXISTS "homes_areas_read" ON homes_areas;
CREATE POLICY "homes_areas_read" ON homes_areas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "homes_areas_write" ON homes_areas;
CREATE POLICY "homes_areas_write" ON homes_areas FOR ALL TO authenticated
  USING (homes_is_admin()) WITH CHECK (homes_is_admin());

DROP POLICY IF EXISTS "homes_lists_read" ON homes_lists;
CREATE POLICY "homes_lists_read" ON homes_lists FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "homes_lists_write" ON homes_lists;
CREATE POLICY "homes_lists_write" ON homes_lists FOR ALL TO authenticated
  USING (homes_is_admin()) WITH CHECK (homes_is_admin());

DROP POLICY IF EXISTS "homes_approvals_read" ON homes_approvals;
CREATE POLICY "homes_approvals_read" ON homes_approvals FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "homes_approvals_write" ON homes_approvals;
CREATE POLICY "homes_approvals_write" ON homes_approvals FOR ALL TO authenticated
  USING (homes_is_admin()) WITH CHECK (homes_is_admin());

DROP POLICY IF EXISTS "homes_yomi_rates_read" ON homes_yomi_rates;
CREATE POLICY "homes_yomi_rates_read" ON homes_yomi_rates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "homes_yomi_rates_write" ON homes_yomi_rates;
CREATE POLICY "homes_yomi_rates_write" ON homes_yomi_rates FOR ALL TO authenticated
  USING (homes_is_admin()) WITH CHECK (homes_is_admin());

-- =====================================================================
-- companies: 認証済み全員に SELECT/UPDATE。INSERT/DELETE は ADMIN/PM
-- =====================================================================
DROP POLICY IF EXISTS "homes_companies_read" ON homes_companies;
CREATE POLICY "homes_companies_read" ON homes_companies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "homes_companies_update" ON homes_companies;
CREATE POLICY "homes_companies_update" ON homes_companies FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "homes_companies_admin_insert" ON homes_companies;
CREATE POLICY "homes_companies_admin_insert" ON homes_companies FOR INSERT TO authenticated
  WITH CHECK (homes_is_admin());
DROP POLICY IF EXISTS "homes_companies_admin_delete" ON homes_companies;
CREATE POLICY "homes_companies_admin_delete" ON homes_companies FOR DELETE TO authenticated
  USING (homes_is_admin());

-- =====================================================================
-- activities: 自分のものを書き込める。読みは全員。削除は ADMIN
-- =====================================================================
DROP POLICY IF EXISTS "homes_activities_read" ON homes_activities;
CREATE POLICY "homes_activities_read" ON homes_activities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "homes_activities_insert" ON homes_activities;
CREATE POLICY "homes_activities_insert" ON homes_activities FOR INSERT TO authenticated
  WITH CHECK (user_id = homes_current_user_id() OR homes_is_admin());
DROP POLICY IF EXISTS "homes_activities_update" ON homes_activities;
CREATE POLICY "homes_activities_update" ON homes_activities FOR UPDATE TO authenticated
  USING (user_id = homes_current_user_id() OR homes_is_admin())
  WITH CHECK (user_id = homes_current_user_id() OR homes_is_admin());
DROP POLICY IF EXISTS "homes_activities_delete" ON homes_activities;
CREATE POLICY "homes_activities_delete" ON homes_activities FOR DELETE TO authenticated
  USING (homes_is_admin());

-- =====================================================================
-- deals / meetings: 認証済み全員 read。書き込みはアサイン者 + ADMIN
-- =====================================================================
DROP POLICY IF EXISTS "homes_deals_read" ON homes_deals;
CREATE POLICY "homes_deals_read" ON homes_deals FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "homes_deals_write" ON homes_deals;
CREATE POLICY "homes_deals_write" ON homes_deals FOR ALL TO authenticated
  USING (
    closer_user_id = homes_current_user_id()
    OR appointer_user_id = homes_current_user_id()
    OR homes_is_admin()
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "homes_meetings_read" ON homes_meetings;
CREATE POLICY "homes_meetings_read" ON homes_meetings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "homes_meetings_write" ON homes_meetings;
CREATE POLICY "homes_meetings_write" ON homes_meetings FOR ALL TO authenticated
  USING (
    closer_user_id = homes_current_user_id()
    OR created_by = homes_current_user_id()
    OR homes_is_admin()
  )
  WITH CHECK (true);

-- =====================================================================
-- collections: 回収アサイン者 + ADMIN/SV
-- =====================================================================
DROP POLICY IF EXISTS "homes_collections_read" ON homes_collections;
CREATE POLICY "homes_collections_read" ON homes_collections FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "homes_collections_write" ON homes_collections;
CREATE POLICY "homes_collections_write" ON homes_collections FOR ALL TO authenticated
  USING (
    collector_user_id = homes_current_user_id()
    OR ba_remind_user_id = homes_current_user_id()
    OR homes_is_admin()
  )
  WITH CHECK (true);

-- =====================================================================
-- orders: 受注作成は CLOSER/COLLECTOR/ADMIN
-- =====================================================================
DROP POLICY IF EXISTS "homes_orders_read" ON homes_orders;
CREATE POLICY "homes_orders_read" ON homes_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "homes_orders_insert" ON homes_orders;
CREATE POLICY "homes_orders_insert" ON homes_orders FOR INSERT TO authenticated
  WITH CHECK (
    closer_user_id = homes_current_user_id()
    OR collector_user_id = homes_current_user_id()
    OR homes_is_admin()
  );
DROP POLICY IF EXISTS "homes_orders_update" ON homes_orders;
CREATE POLICY "homes_orders_update" ON homes_orders FOR UPDATE TO authenticated
  USING (
    closer_user_id = homes_current_user_id()
    OR collector_user_id = homes_current_user_id()
    OR homes_is_admin()
  )
  WITH CHECK (true);
DROP POLICY IF EXISTS "homes_orders_admin_delete" ON homes_orders;
CREATE POLICY "homes_orders_admin_delete" ON homes_orders FOR DELETE TO authenticated
  USING (homes_is_admin());

-- =====================================================================
-- View 単位の権限はベーステーブルRLSで担保される (security invoker)
-- =====================================================================
