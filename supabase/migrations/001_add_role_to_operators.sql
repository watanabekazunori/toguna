-- operatorsテーブルにroleカラムを追加
ALTER TABLE operators
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'operator';

-- roleの値を制限するチェック制約
ALTER TABLE operators
ADD CONSTRAINT operators_role_check
CHECK (role IN ('director', 'operator'));

-- 既存のオペレーターをアップデート（例: 最初のオペレーターをディレクターに）
-- UPDATE operators SET role = 'director' WHERE id = '<your-director-id>';

-- Supabase Authのauth.usersテーブルと連携するためのトリガー（オプション）
-- 新規ユーザー登録時にoperatorsテーブルにも自動追加
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.operators (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'operator')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トリガーを作成（既存のトリガーがあれば削除してから作成）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
