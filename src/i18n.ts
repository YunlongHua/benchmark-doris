export const translations = {
  'zh-CN': {
    logPanel: '日志面板',
    sqlTerminal: 'SQL 终端',
    run: '运行',
    build: '编译构建',
    generateData: '生成数据',
    createTables: '初始化表',
    loadData: '加载数据',
    runQueries: '运行查询',
    uploadTools: '上传工具',
    download: '下载',
    clear: '清空',
    format: '格式化',
    log: '日志',
    sql: 'SQL',
  },
  'en-US': {
    logPanel: 'Log Panel',
    sqlTerminal: 'SQL Terminal',
    run: 'Run',
    build: 'Build',
    generateData: 'Generate Data',
    createTables: 'Create Tables',
    loadData: 'Load Data',
    runQueries: 'Run Queries',
    uploadTools: 'Upload Tools',
    download: 'Download',
    clear: 'Clear',
    format: 'Format',
    log: 'Log',
    sql: 'SQL',
  }
}

export type Language = keyof typeof translations
export type TranslationKey = keyof typeof translations['en-US']

export function t(key: TranslationKey, lang: Language): string {
  return translations[lang][key] || key
}