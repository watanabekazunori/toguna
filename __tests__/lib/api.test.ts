import { describe, it, expect, vi } from 'vitest'
import { parseCSV, csvRowsToCompanies } from '@/lib/api'

describe('API Functions', () => {
  describe('parseCSV', () => {
    it('should parse valid CSV data with correct headers', () => {
      const csv = `企業名,業種,従業員数,所在地,電話番号,ウェブサイト
テスト会社,IT,50,東京都渋谷区,03-1234-5678,https://test.com`

      const result = parseCSV(csv)

      expect(result).toHaveLength(1)
      expect(result[0]['企業名']).toBe('テスト会社')
      expect(result[0]['業種']).toBe('IT')
      expect(result[0]['従業員数']).toBe('50')
      expect(result[0]['所在地']).toBe('東京都渋谷区')
      expect(result[0]['電話番号']).toBe('03-1234-5678')
      expect(result[0]['ウェブサイト']).toBe('https://test.com')
    })

    it('should parse CSV with multiple rows', () => {
      const csv = `企業名,業種,従業員数,所在地
会社A,IT,100,東京
会社B,製造,200,大阪
会社C,流通,300,福岡`

      const result = parseCSV(csv)

      expect(result).toHaveLength(3)
      expect(result[0]['企業名']).toBe('会社A')
      expect(result[1]['企業名']).toBe('会社B')
      expect(result[2]['企業名']).toBe('会社C')
    })

    it('should return empty array for empty CSV', () => {
      const result = parseCSV('')
      expect(result).toEqual([])
    })

    it('should return empty array for CSV with only header', () => {
      const csv = '企業名,業種,従業員数'
      const result = parseCSV(csv)
      expect(result).toEqual([])
    })

    it('should handle whitespace in values correctly', () => {
      const csv = `企業名,業種,従業員数
  テスト会社  ,  IT  ,  50  `

      const result = parseCSV(csv)

      expect(result).toHaveLength(1)
      expect(result[0]['企業名']).toBe('テスト会社')
      expect(result[0]['業種']).toBe('IT')
      expect(result[0]['従業員数']).toBe('50')
    })

    it('should skip rows with mismatched column count', () => {
      const csv = `企業名,業種,従業員数
テスト会社,IT,50
不完全な行,IT
完全な行,製造,200`

      const result = parseCSV(csv)

      expect(result).toHaveLength(1)
      expect(result[0]['企業名']).toBe('完全な行')
    })
  })

  describe('csvRowsToCompanies', () => {
    it('should convert simple format CSV rows to companies', () => {
      const rows = [
        {
          '企業名': 'テスト会社A',
          '業種': 'IT',
          '従業員数': '100',
          '所在地': '東京都',
          '電話番号': '03-1234-5678',
          'ウェブサイト': 'https://test-a.com',
        },
      ]

      const result = csvRowsToCompanies(rows, 'client-123')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('テスト会社A')
      expect(result[0].industry).toBe('IT')
      expect(result[0].employees).toBe(100)
      expect(result[0].location).toBe('東京都')
      expect(result[0].phone).toBe('03-1234-5678')
      expect(result[0].website).toBe('https://test-a.com')
      expect(result[0].client_id).toBe('client-123')
    })

    it('should convert SalesRadar format CSV rows to companies', () => {
      const rows = [
        {
          '法人名称': 'SalesRadar会社',
          '業種': 'コンサルティング',
          '従業員数(人)': '50以上～100未満',
          '本社所在地(WEBサイト掲載)': '大阪府大阪市',
          '電話番号': '06-9876-5432',
          'サイトURL': 'https://salesradar.jp',
        },
      ]

      const result = csvRowsToCompanies(rows, 'client-456')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('SalesRadar会社')
      expect(result[0].industry).toBe('コンサルティング')
      expect(result[0].location).toBe('大阪府大阪市')
      expect(result[0].phone).toBe('06-9876-5432')
      expect(result[0].website).toBe('https://salesradar.jp')
      expect(result[0].client_id).toBe('client-456')
    })

    it('should handle multiple companies', () => {
      const rows = [
        {
          '企業名': '会社1',
          '業種': 'IT',
          '従業員数': '100',
          '所在地': '東京',
          '電話番号': '03-1111-1111',
          'ウェブサイト': 'https://1.com',
        },
        {
          '企業名': '会社2',
          '業種': '製造',
          '従業員数': '200',
          '所在地': '大阪',
          '電話番号': '06-2222-2222',
          'ウェブサイト': 'https://2.com',
        },
      ]

      const result = csvRowsToCompanies(rows, 'client-789')

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('会社1')
      expect(result[1].name).toBe('会社2')
    })

    it('should return empty array for empty rows', () => {
      const result = csvRowsToCompanies([], 'client-123')
      expect(result).toEqual([])
    })

    it('should handle missing optional fields gracefully', () => {
      const rows = [
        {
          '企業名': 'ミニマル会社',
          '業種': 'サービス',
          '従業員数': '10',
          '所在地': '東京',
          // missing phone and website
        },
      ]

      const result = csvRowsToCompanies(rows, 'client-000')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('ミニマル会社')
      expect(result[0].client_id).toBe('client-000')
    })
  })
})
