const ENGLISH_CITY_MAP: Array<{ pattern: RegExp; city: string }> = [
  { pattern: /\bbeijing\b/i, city: '北京市' },
  { pattern: /\bshanghai\b/i, city: '上海市' },
  { pattern: /\bshenzhen\b/i, city: '深圳市' },
  { pattern: /\bguangzhou\b/i, city: '广州市' },
  { pattern: /\bhangzhou\b/i, city: '杭州市' },
  { pattern: /\bnanjing\b/i, city: '南京市' },
  { pattern: /\bsuzhou\b/i, city: '苏州市' },
  { pattern: /\bchengdu\b/i, city: '成都市' },
  { pattern: /\bwuhan\b/i, city: '武汉市' },
  { pattern: /\bxian\b/i, city: '西安市' },
  { pattern: /\btianjin\b/i, city: '天津市' },
  { pattern: /\bchongqing\b/i, city: '重庆市' },
  { pattern: /\bchangsha\b/i, city: '长沙市' },
  { pattern: /\bqingdao\b/i, city: '青岛市' },
  { pattern: /\bxiamen\b/i, city: '厦门市' },
  { pattern: /\bhefei\b/i, city: '合肥市' },
  { pattern: /\bzhengzhou\b/i, city: '郑州市' },
  { pattern: /\bfoshan\b/i, city: '佛山市' },
  { pattern: /\bdongguan\b/i, city: '东莞市' },
  { pattern: /\bningbo\b/i, city: '宁波市' },
  { pattern: /\bwuxi\b/i, city: '无锡市' },
  { pattern: /\bfuzhou\b/i, city: '福州市' },
  { pattern: /\bjinan\b/i, city: '济南市' },
  { pattern: /\bzhuhai\b/i, city: '珠海市' },
  { pattern: /\bdalian\b/i, city: '大连市' },
  { pattern: /\bshenyang\b/i, city: '沈阳市' },
  { pattern: /\bnanning\b/i, city: '南宁市' },
]

const CHINESE_CITY_PATTERNS: Array<{ pattern: RegExp; city: string }> = [
  { pattern: /北京/, city: '北京市' },
  { pattern: /上海/, city: '上海市' },
  { pattern: /深圳/, city: '深圳市' },
  { pattern: /广州/, city: '广州市' },
  { pattern: /杭州/, city: '杭州市' },
  { pattern: /南京/, city: '南京市' },
  { pattern: /苏州/, city: '苏州市' },
  { pattern: /成都/, city: '成都市' },
  { pattern: /武汉/, city: '武汉市' },
  { pattern: /西安/, city: '西安市' },
  { pattern: /天津/, city: '天津市' },
  { pattern: /重庆/, city: '重庆市' },
  { pattern: /长沙/, city: '长沙市' },
  { pattern: /青岛/, city: '青岛市' },
  { pattern: /厦门/, city: '厦门市' },
  { pattern: /合肥/, city: '合肥市' },
  { pattern: /郑州/, city: '郑州市' },
  { pattern: /佛山/, city: '佛山市' },
  { pattern: /东莞/, city: '东莞市' },
  { pattern: /宁波/, city: '宁波市' },
  { pattern: /无锡/, city: '无锡市' },
  { pattern: /福州/, city: '福州市' },
  { pattern: /济南/, city: '济南市' },
  { pattern: /珠海/, city: '珠海市' },
  { pattern: /大连/, city: '大连市' },
  { pattern: /沈阳/, city: '沈阳市' },
  { pattern: /南宁/, city: '南宁市' },
]

function normalizeNullableString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeCityLocation(value: string | null | undefined) {
  const raw = normalizeNullableString(value)
  if (!raw) {
    return null
  }

  if (/remote|远程/i.test(raw)) {
    return '远程'
  }

  for (const item of CHINESE_CITY_PATTERNS) {
    if (item.pattern.test(raw)) {
      return item.city
    }
  }

  for (const item of ENGLISH_CITY_MAP) {
    if (item.pattern.test(raw)) {
      return item.city
    }
  }

  const chineseMatch = raw.match(/([\u4e00-\u9fa5]{2,}市)/)
  if (chineseMatch?.[1]) {
    return chineseMatch[1]
  }

  const directCity = raw.match(/([\u4e00-\u9fa5]{2,})(?:区|县|州|镇)/)
  if (directCity?.[1]) {
    return `${directCity[1]}市`
  }

  return raw
}
