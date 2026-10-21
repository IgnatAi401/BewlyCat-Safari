import type browser from 'webextension-polyfill'

// Safari 的 declarativeNetRequest 不支持正则中的 `|`，也不认识 sec-ch-ua* 请求头。
const SAFARI_UNSUPPORTED_HEADERS = /^sec-ch-ua/i
// 拆出的规则 id = 原 id + 序号 × 偏移，删除时一并删除。
const SPLIT_RULE_ID_OFFSET = 100
const MAX_SPLIT_RULES = 9

type Rule = browser.DeclarativeNetRequest.Rule
type UpdateRuleOptions = browser.DeclarativeNetRequest.UpdateDynamicRulesOptionsType

export function expandRegexAlternation(regex: string): string[] {
  const match = /\(([^()|]*\|[^()]*)\)/.exec(regex)
  if (!match)
    return [regex]
  const before = regex.slice(0, match.index)
  const after = regex.slice(match.index + match[0].length)
  return match[1].split('|').flatMap(option => expandRegexAlternation(`${before}${option}${after}`))
}

function toSafariRules(rule: Rule): Rule[] {
  const requestHeaders = rule.action.requestHeaders?.filter(header => !SAFARI_UNSUPPORTED_HEADERS.test(header.header))
  const action = requestHeaders ? { ...rule.action, requestHeaders } : rule.action
  const regexFilters = rule.condition.regexFilter ? expandRegexAlternation(rule.condition.regexFilter) : [undefined]
  return regexFilters.slice(0, MAX_SPLIT_RULES + 1).map((regexFilter, index) => ({
    ...rule,
    id: rule.id + index * SPLIT_RULE_ID_OFFSET,
    action,
    condition: regexFilter ? { ...rule.condition, regexFilter } : rule.condition,
  }))
}

// 非 Safari 构建原样返回；Safari 中把规则改写为可接受的形式。
export function adaptSafariRuleUpdate<T extends UpdateRuleOptions>(options: T): T {
  if (!__SAFARI__)
    return options
  const removeRuleIds = options.removeRuleIds?.flatMap(id =>
    Array.from({ length: MAX_SPLIT_RULES + 1 }, (_, index) => id + index * SPLIT_RULE_ID_OFFSET),
  )
  return {
    ...options,
    ...(removeRuleIds ? { removeRuleIds } : {}),
    ...(options.addRules ? { addRules: options.addRules.flatMap(toSafariRules) } : {}),
  }
}
