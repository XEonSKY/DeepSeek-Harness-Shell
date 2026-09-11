import type { SearchEngineId } from '@shared/types'

/**
 * 搜索引擎支持：ID 顺序即下拉展示顺序。仅存 ID 到 settings；搜索 URL 模板在此（renderer）。
 */
export const SEARCH_ENGINE_IDS: SearchEngineId[] = ['baidu', 'sogou', '360', 'bing', 'google', 'duckduckgo']

/** 各引擎的 i18n 文案键（用于标签页下拉/设置项）。 */
export const ENGINE_LABEL_KEY: Record<SearchEngineId, string> = {
    baidu: 'engine.baidu',
    sogou: 'engine.sogou',
    360: 'engine.q360',
    bing: 'engine.bing',
    google: 'engine.google',
    duckduckgo: 'engine.duckduckgo'
}

/** 各引擎搜索 URL 模板（用 {q} 占位查询词）。 */
const ENGINE_TEMPLATE: Record<SearchEngineId, string> = {
    baidu: 'https://www.baidu.com/s?wd={q}',
    sogou: 'https://www.sogou.com/web?query={q}',
    360: 'https://www.so.com/s?q={q}',
    bing: 'https://www.bing.com/search?q={q}',
    google: 'https://www.google.com/search?q={q}',
    duckduckgo: 'https://duckduckgo.com/?q={q}'
}

/** 生成某引擎的搜索 URL。 */
export function buildSearchUrl(engine: SearchEngineId, query: string): string {
    const tpl = ENGINE_TEMPLATE[engine] ?? ENGINE_TEMPLATE.bing
    return tpl.replace('{q}', encodeURIComponent(query))
}
