/**
 * LIFULL_HOMES テナント ロール定義と権限チェック
 *
 * APPOINTER / CLOSER / MANAGER / ADMIN の 4 ロールを定義し、
 * ロール階層に基づいた権限チェック関数を提供する。
 *
 * 対応 threat:
 *   E-01 APPOINTER が CLOSER 商談データ参照 — hasPermission() で操作別制御
 *   E-02 SECURITY DEFINER 関数バイパス — ロール階層を DB 側の RLS と一致させる
 *
 * RLS の role 条件と必ず同期を保つこと (ADR-0003 参照)。
 */

// ---------------------------------------------------------------------------
// Role enum
// ---------------------------------------------------------------------------

/** LIFULL_HOMES テナントのロール一覧 (権限昇順) */
export const LifullRole = {
  APPOINTER: 'APPOINTER',
  CLOSER: 'CLOSER',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
} as const

export type LifullRole = (typeof LifullRole)[keyof typeof LifullRole]

/** ロールの権限階層 (数値が大きいほど強い) */
const ROLE_HIERARCHY: Record<LifullRole, number> = {
  APPOINTER: 10,
  CLOSER: 20,
  MANAGER: 30,
  ADMIN: 40,
}

// ---------------------------------------------------------------------------
// Action definitions
// ---------------------------------------------------------------------------

/**
 * システム内のアクション一覧。
 * DB RLS ポリシー名と 1:1 で対応させること。
 */
export const LifullAction = {
  // コール系
  CREATE_ACTIVITY: 'CREATE_ACTIVITY',
  READ_OWN_ACTIVITY: 'READ_OWN_ACTIVITY',
  READ_ALL_ACTIVITIES: 'READ_ALL_ACTIVITIES',
  UPDATE_OWN_ACTIVITY: 'UPDATE_OWN_ACTIVITY',

  // 商談系
  READ_DEAL: 'READ_DEAL',
  CREATE_DEAL: 'CREATE_DEAL',
  UPDATE_DEAL: 'UPDATE_DEAL',
  DELETE_DEAL: 'DELETE_DEAL',

  // 商談枠予約
  READ_CLOSER_SLOTS: 'READ_CLOSER_SLOTS',
  CREATE_CLOSER_SLOT: 'CREATE_CLOSER_SLOT',
  DELETE_CLOSER_SLOT: 'DELETE_CLOSER_SLOT',

  // AI 出力
  READ_AI_OUTPUT: 'READ_AI_OUTPUT',
  CONFIRM_AI_OUTPUT: 'CONFIRM_AI_OUTPUT',

  // 受注
  READ_ORDER: 'READ_ORDER',
  CREATE_ORDER: 'CREATE_ORDER',
  UPDATE_ORDER: 'UPDATE_ORDER',

  // 管理系
  MANAGE_USERS: 'MANAGE_USERS',
  VIEW_KPI: 'VIEW_KPI',
  MANAGE_SETTINGS: 'MANAGE_SETTINGS',
  EXPORT_DATA: 'EXPORT_DATA',
} as const

export type LifullAction = (typeof LifullAction)[keyof typeof LifullAction]

// ---------------------------------------------------------------------------
// Permission matrix
// ---------------------------------------------------------------------------

/**
 * ロール × アクション の許可マトリクス。
 * true = 許可、false = 拒否。
 * 階層チェックではなく明示的に定義する (誤った権限昇格を防ぐ)。
 */
const PERMISSION_MATRIX: Record<LifullRole, Set<LifullAction>> = {
  APPOINTER: new Set<LifullAction>([
    'CREATE_ACTIVITY',
    'READ_OWN_ACTIVITY',
    'UPDATE_OWN_ACTIVITY',
    'READ_CLOSER_SLOTS',    // アポ取り後に空き枠確認
    'READ_AI_OUTPUT',
    'CONFIRM_AI_OUTPUT',
    'VIEW_KPI',             // 自分の KPI のみ (RLS で絞る)
  ]),

  CLOSER: new Set<LifullAction>([
    'CREATE_ACTIVITY',
    'READ_OWN_ACTIVITY',
    'READ_ALL_ACTIVITIES',  // 担当案件の活動履歴参照
    'UPDATE_OWN_ACTIVITY',
    'READ_DEAL',
    'CREATE_DEAL',
    'UPDATE_DEAL',
    'READ_CLOSER_SLOTS',
    'CREATE_CLOSER_SLOT',
    'DELETE_CLOSER_SLOT',
    'READ_AI_OUTPUT',
    'CONFIRM_AI_OUTPUT',
    'READ_ORDER',
    'CREATE_ORDER',
    'UPDATE_ORDER',
    'VIEW_KPI',
  ]),

  MANAGER: new Set<LifullAction>([
    'CREATE_ACTIVITY',
    'READ_OWN_ACTIVITY',
    'READ_ALL_ACTIVITIES',
    'UPDATE_OWN_ACTIVITY',
    'READ_DEAL',
    'CREATE_DEAL',
    'UPDATE_DEAL',
    'DELETE_DEAL',
    'READ_CLOSER_SLOTS',
    'CREATE_CLOSER_SLOT',
    'DELETE_CLOSER_SLOT',
    'READ_AI_OUTPUT',
    'CONFIRM_AI_OUTPUT',
    'READ_ORDER',
    'CREATE_ORDER',
    'UPDATE_ORDER',
    'VIEW_KPI',
    'EXPORT_DATA',
  ]),

  ADMIN: new Set<LifullAction>([
    'CREATE_ACTIVITY',
    'READ_OWN_ACTIVITY',
    'READ_ALL_ACTIVITIES',
    'UPDATE_OWN_ACTIVITY',
    'READ_DEAL',
    'CREATE_DEAL',
    'UPDATE_DEAL',
    'DELETE_DEAL',
    'READ_CLOSER_SLOTS',
    'CREATE_CLOSER_SLOT',
    'DELETE_CLOSER_SLOT',
    'READ_AI_OUTPUT',
    'CONFIRM_AI_OUTPUT',
    'READ_ORDER',
    'CREATE_ORDER',
    'UPDATE_ORDER',
    'MANAGE_USERS',
    'VIEW_KPI',
    'MANAGE_SETTINGS',
    'EXPORT_DATA',
  ]),
}

// ---------------------------------------------------------------------------
// Permission check functions
// ---------------------------------------------------------------------------

/**
 * 指定ロールが指定アクションを実行できるかどうかを返す。
 *
 * @param role 実行者のロール
 * @param action 実行しようとしているアクション
 * @returns true = 許可
 */
export function hasPermission(role: LifullRole, action: LifullAction): boolean {
  return PERMISSION_MATRIX[role]?.has(action) ?? false
}

/**
 * 指定ロールが最低要件ロール以上かどうかを階層で判定する。
 * より細かい制御が不要な場合に使用する簡易ヘルパー。
 *
 * @param role 実行者のロール
 * @param minimumRole 要求する最低ロール
 * @returns true = role が minimumRole 以上
 */
export function hasMinimumRole(role: LifullRole, minimumRole: LifullRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimumRole]
}

/**
 * ロール文字列を LifullRole 型にパースする。
 * 不正値の場合は null を返す (認可エラーは呼び出し元で処理)。
 *
 * @param raw DB / JWT クレームから取得したロール文字列
 */
export function parseLifullRole(raw: string): LifullRole | null {
  if (Object.values(LifullRole).includes(raw as LifullRole)) {
    return raw as LifullRole
  }
  return null
}

/**
 * ロール一覧を権限昇順でソートして返す。
 * UI のセレクトボックス表示順などに使用する。
 */
export function getSortedRoles(): LifullRole[] {
  return (Object.keys(ROLE_HIERARCHY) as LifullRole[]).sort(
    (a, b) => ROLE_HIERARCHY[a] - ROLE_HIERARCHY[b]
  )
}

// END_OF_FILE
