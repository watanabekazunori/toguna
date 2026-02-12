-- Migration: 20260211 - Row Level Security Policies
-- Purpose: Enable RLS and create policies for all main tables in Toguna app
-- This ensures data isolation between operators and proper access control for directors

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Check if current user is a director
-- ディレクターかどうかを確認する関数
CREATE OR REPLACE FUNCTION is_director() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM operators
    WHERE id = auth.uid()::text
    AND role = 'director'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Get current operator ID from auth.uid()
-- 現在のオペレーターIDを取得する関数
CREATE OR REPLACE FUNCTION current_operator_id() RETURNS text AS $$
  SELECT auth.uid()::text;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- Enable RLS on tables
-- ============================================================================

-- オペレーターテーブルのRLSを有効化
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;

-- 通話ログテーブルのRLSを有効化
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- 企業テーブルのRLSを有効化
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- プロジェクトテーブルのRLSを有効化
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 予約テーブルのRLSを有効化
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- 通話品質スコアテーブルのRLSを有効化
ALTER TABLE call_quality_scores ENABLE ROW LEVEL SECURITY;

-- 設定テーブルのRLSを有効化
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Operators Table Policies
-- オペレーターテーブルのポリシー
-- ============================================================================

-- オペレーターは自分のデータを読むことができる
-- Operators can read their own data
CREATE POLICY operators_select_self ON operators
  FOR SELECT
  USING (id = current_operator_id());

-- ディレクターはすべてのオペレーターを読むことができる
-- Directors can read all operators
CREATE POLICY operators_select_director ON operators
  FOR SELECT
  USING (is_director());

-- オペレーターは自分の情報を更新できる
-- Operators can update their own information
CREATE POLICY operators_update_self ON operators
  FOR UPDATE
  USING (id = current_operator_id())
  WITH CHECK (id = current_operator_id());

-- ディレクターはすべてのオペレーター情報を更新できる
-- Directors can update all operators
CREATE POLICY operators_update_director ON operators
  FOR UPDATE
  USING (is_director())
  WITH CHECK (true);

-- ディレクターのみが新しいオペレーターを作成できる
-- Only directors can create new operators
CREATE POLICY operators_insert_director ON operators
  FOR INSERT
  WITH CHECK (is_director());

-- ディレクターのみオペレーターを削除できる
-- Only directors can delete operators
CREATE POLICY operators_delete_director ON operators
  FOR DELETE
  USING (is_director());

-- ============================================================================
-- Call Logs Table Policies
-- 通話ログテーブルのポリシー
-- ============================================================================

-- オペレーターは自分の通話ログを読むことができる
-- Operators can read their own call logs
CREATE POLICY call_logs_select_own ON call_logs
  FOR SELECT
  USING (operator_id = current_operator_id());

-- ディレクターはすべての通話ログを読むことができる
-- Directors can read all call logs
CREATE POLICY call_logs_select_director ON call_logs
  FOR SELECT
  USING (is_director());

-- オペレーターは自分の通話ログを作成・更新できる
-- Operators can create and update their own call logs
CREATE POLICY call_logs_insert_own ON call_logs
  FOR INSERT
  WITH CHECK (operator_id = current_operator_id());

CREATE POLICY call_logs_update_own ON call_logs
  FOR UPDATE
  USING (operator_id = current_operator_id())
  WITH CHECK (operator_id = current_operator_id());

-- ディレクターはすべての通話ログを操作できる
-- Directors can manage all call logs
CREATE POLICY call_logs_insert_director ON call_logs
  FOR INSERT
  WITH CHECK (is_director());

CREATE POLICY call_logs_update_director ON call_logs
  FOR UPDATE
  USING (is_director())
  WITH CHECK (true);

CREATE POLICY call_logs_delete_director ON call_logs
  FOR DELETE
  USING (is_director());

-- ============================================================================
-- Companies Table Policies
-- 企業テーブルのポリシー
-- ============================================================================

-- オペレーターは割り当てられたプロジェクト内の企業を読むことができる
-- Operators can read companies in their assigned projects
CREATE POLICY companies_select_assigned ON companies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_assignments pa
      JOIN projects p ON pa.project_id = p.id
      WHERE p.id = companies.project_id
      AND pa.operator_id = current_operator_id()
    )
  );

-- ディレクターはすべての企業を読むことができる
-- Directors can read all companies
CREATE POLICY companies_select_director ON companies
  FOR SELECT
  USING (is_director());

-- オペレーターは割り当てられたプロジェクト内の企業を作成・更新できる
-- Operators can create and update companies in their assigned projects
CREATE POLICY companies_insert_assigned ON companies
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_assignments pa
      JOIN projects p ON pa.project_id = p.id
      WHERE p.id = companies.project_id
      AND pa.operator_id = current_operator_id()
    )
  );

CREATE POLICY companies_update_assigned ON companies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_assignments pa
      JOIN projects p ON pa.project_id = p.id
      WHERE p.id = companies.project_id
      AND pa.operator_id = current_operator_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_assignments pa
      JOIN projects p ON pa.project_id = p.id
      WHERE p.id = companies.project_id
      AND pa.operator_id = current_operator_id()
    )
  );

-- ディレクターはすべての企業を操作できる
-- Directors can manage all companies
CREATE POLICY companies_insert_director ON companies
  FOR INSERT
  WITH CHECK (is_director());

CREATE POLICY companies_update_director ON companies
  FOR UPDATE
  USING (is_director())
  WITH CHECK (true);

CREATE POLICY companies_delete_director ON companies
  FOR DELETE
  USING (is_director());

-- ============================================================================
-- Projects Table Policies
-- プロジェクトテーブルのポリシー
-- ============================================================================

-- オペレーターは割り当てられたプロジェクトを読むことができる
-- Operators can read their assigned projects
CREATE POLICY projects_select_assigned ON projects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_assignments pa
      WHERE pa.project_id = projects.id
      AND pa.operator_id = current_operator_id()
    )
  );

-- ディレクターはすべてのプロジェクトを読むことができる
-- Directors can read all projects
CREATE POLICY projects_select_director ON projects
  FOR SELECT
  USING (is_director());

-- ディレクターのみがプロジェクトを作成できる
-- Only directors can create projects
CREATE POLICY projects_insert_director ON projects
  FOR INSERT
  WITH CHECK (is_director());

-- ディレクターのみがプロジェクトを更新できる
-- Only directors can update projects
CREATE POLICY projects_update_director ON projects
  FOR UPDATE
  USING (is_director())
  WITH CHECK (true);

-- ディレクターのみがプロジェクトを削除できる
-- Only directors can delete projects
CREATE POLICY projects_delete_director ON projects
  FOR DELETE
  USING (is_director());

-- ============================================================================
-- Appointments Table Policies
-- 予約テーブルのポリシー
-- ============================================================================

-- オペレーターは自分の予約を読むことができる
-- Operators can read their own appointments
CREATE POLICY appointments_select_own ON appointments
  FOR SELECT
  USING (operator_id = current_operator_id());

-- ディレクターはすべての予約を読むことができる
-- Directors can read all appointments
CREATE POLICY appointments_select_director ON appointments
  FOR SELECT
  USING (is_director());

-- オペレーターは自分の予約を作成・更新できる
-- Operators can create and update their own appointments
CREATE POLICY appointments_insert_own ON appointments
  FOR INSERT
  WITH CHECK (operator_id = current_operator_id());

CREATE POLICY appointments_update_own ON appointments
  FOR UPDATE
  USING (operator_id = current_operator_id())
  WITH CHECK (operator_id = current_operator_id());

-- ディレクターはすべての予約を操作できる
-- Directors can manage all appointments
CREATE POLICY appointments_insert_director ON appointments
  FOR INSERT
  WITH CHECK (is_director());

CREATE POLICY appointments_update_director ON appointments
  FOR UPDATE
  USING (is_director())
  WITH CHECK (true);

CREATE POLICY appointments_delete_director ON appointments
  FOR DELETE
  USING (is_director());

-- ============================================================================
-- Call Quality Scores Table Policies
-- 通話品質スコアテーブルのポリシー
-- ============================================================================

-- オペレーターは自分のスコアを読むことができる
-- Operators can read their own quality scores
CREATE POLICY call_quality_scores_select_own ON call_quality_scores
  FOR SELECT
  USING (
    operator_id = current_operator_id()
  );

-- ディレクターはすべてのスコアを読むことができる
-- Directors can read all quality scores
CREATE POLICY call_quality_scores_select_director ON call_quality_scores
  FOR SELECT
  USING (is_director());

-- ディレクターのみがスコアを作成できる
-- Only directors can create quality scores (usually from analysis system)
CREATE POLICY call_quality_scores_insert_director ON call_quality_scores
  FOR INSERT
  WITH CHECK (is_director());

-- ディレクターのみがスコアを更新できる
-- Only directors can update quality scores
CREATE POLICY call_quality_scores_update_director ON call_quality_scores
  FOR UPDATE
  USING (is_director())
  WITH CHECK (true);

-- ============================================================================
-- Settings Table Policies
-- 設定テーブルのポリシー
-- ============================================================================

-- ユーザーは自分の設定のみを読むことができる
-- Users can only read their own settings
CREATE POLICY settings_select_own ON settings
  FOR SELECT
  USING (user_id = current_operator_id());

-- ユーザーは自分の設定を作成・更新できる
-- Users can create and update their own settings
CREATE POLICY settings_insert_own ON settings
  FOR INSERT
  WITH CHECK (user_id = current_operator_id());

CREATE POLICY settings_update_own ON settings
  FOR UPDATE
  USING (user_id = current_operator_id())
  WITH CHECK (user_id = current_operator_id());

-- ユーザーは自分の設定を削除できる
-- Users can delete their own settings
CREATE POLICY settings_delete_own ON settings
  FOR DELETE
  USING (user_id = current_operator_id());

-- ============================================================================
-- Grant Permissions to Authenticated Users
-- ============================================================================

-- All authenticated users should be able to query the helper functions
-- 認証されたすべてのユーザーはヘルパー関数を実行できる必要があります
GRANT EXECUTE ON FUNCTION is_director() TO authenticated;
GRANT EXECUTE ON FUNCTION current_operator_id() TO authenticated;

-- ============================================================================
-- Summary of Access Patterns
-- ============================================================================
--
-- operators (オペレーター):
--   - Self: READ, UPDATE
--   - Director: READ ALL, WRITE ALL, CREATE, DELETE
--
-- call_logs (通話ログ):
--   - Self: READ, CREATE, UPDATE
--   - Director: READ ALL, WRITE ALL, DELETE
--
-- companies (企業):
--   - Assigned Project: READ, CREATE, UPDATE
--   - Director: READ ALL, WRITE ALL, DELETE
--
-- projects (プロジェクト):
--   - Assigned: READ
--   - Director: READ ALL, CREATE, UPDATE, DELETE
--
-- appointments (予約):
--   - Self: READ, CREATE, UPDATE
--   - Director: READ ALL, WRITE ALL, DELETE
--
-- call_quality_scores (品質スコア):
--   - Self: READ
--   - Director: READ ALL, CREATE, UPDATE
--
-- settings (設定):
--   - Self: READ, CREATE, UPDATE, DELETE
--   - Other users: DENIED
--
-- ============================================================================
