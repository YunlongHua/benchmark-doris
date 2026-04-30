import { EnhancedTestResult } from '../../src/types'
import { writeFile } from 'fs/promises'

type BenchmarkTheme = {
  heroGradient: string
  accentPrimary: string
  accentSecondary: string
  accentMuted: string
  surfaceGlow: string
  chartColors: string[]
  title: { zh: string; en: string }
  description: { zh: string; en: string }
}

const THEMES: Record<string, BenchmarkTheme> = {
  ssb: {
    heroGradient: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 50%, #818cf8 100%)',
    accentPrimary: '#6366f1',
    accentSecondary: '#06b6d4',
    accentMuted: 'rgba(99, 102, 241, 0.08)',
    surfaceGlow: 'rgba(99, 102, 241, 0.06)',
    chartColors: ['rgba(99, 102, 241, 0.85)', 'rgba(6, 182, 212, 0.85)', 'rgba(129, 140, 248, 0.85)', 'rgba(34, 211, 238, 0.85)'],
    title: { zh: 'SSB 星型模型基准测试报告', en: 'SSB Star Schema Benchmark Report' },
    description: { zh: '星型模型 OLAP 查询性能基准测试', en: 'Star Schema OLAP Query Performance Benchmark' }
  },
  tpch: {
    heroGradient: 'linear-gradient(135deg, #0891b2 0%, #2563eb 50%, #38bdf8 100%)',
    accentPrimary: '#0891b2',
    accentSecondary: '#2563eb',
    accentMuted: 'rgba(8, 145, 178, 0.08)',
    surfaceGlow: 'rgba(8, 145, 178, 0.06)',
    chartColors: ['rgba(8, 145, 178, 0.85)', 'rgba(37, 99, 235, 0.85)', 'rgba(14, 116, 144, 0.85)', 'rgba(59, 130, 246, 0.85)'],
    title: { zh: 'TPC-H 商业智能基准测试报告', en: 'TPC-H Business Intelligence Benchmark Report' },
    description: { zh: '决策支持系统性能基准测试', en: 'Decision Support System Performance Benchmark' }
  },
  tpcds: {
    heroGradient: 'linear-gradient(135deg, #7c3aed 0%, #f59e0b 50%, #a78bfa 100%)',
    accentPrimary: '#7c3aed',
    accentSecondary: '#f59e0b',
    accentMuted: 'rgba(124, 58, 237, 0.08)',
    surfaceGlow: 'rgba(124, 58, 237, 0.06)',
    chartColors: ['rgba(124, 58, 237, 0.85)', 'rgba(245, 158, 11, 0.85)', 'rgba(139, 92, 246, 0.85)', 'rgba(251, 191, 36, 0.85)'],
    title: { zh: 'TPC-DS 复杂分析基准测试报告', en: 'TPC-DS Complex Analytics Benchmark Report' },
    description: { zh: '复杂分析查询性能基准测试', en: 'Complex Analytical Query Performance Benchmark' }
  }
}

function fmt(ms: number): string {
  if (ms <= 0) return '0ms'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  const m = Math.floor(ms / 60000)
  const s = ((ms % 60000) / 1000).toFixed(1)
  return `${m}m ${s}s`
}

function fmtOrDash(ms: number): string {
  return ms > 0 ? fmt(ms) : '—'
}

function getScoreGrade(score: number): string {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'fair'
  return 'poor'
}

function getConclusion(grade: string, isZh: boolean): { title: string; text: string } {
  const map: Record<string, { title: string; text: string }> = {
    excellent: {
      title: isZh ? '性能卓越' : 'Excellent Performance',
      text: isZh ? 'Doris 集群展现出卓越的查询性能，缓存效率极佳，查询延迟稳定可控。' : 'The cluster demonstrates exceptional query performance with outstanding cache efficiency and stable latency.'
    },
    good: {
      title: isZh ? '性能良好' : 'Good Performance',
      text: isZh ? '集群性能表现稳定，缓存命中率良好。个别查询存在优化空间，建议关注耗时较长的查询。' : 'Solid and stable performance with good cache hit rates. Some queries may benefit from further optimization.'
    },
    fair: {
      title: isZh ? '性能一般' : 'Fair Performance',
      text: isZh ? '性能表现中等，部分查询延迟偏高且波动较大。建议检查数据分布与索引策略。' : 'Moderate performance with room for improvement. Consider reviewing data distribution and index strategies.'
    },
    poor: {
      title: isZh ? '需要改进' : 'Needs Improvement',
      text: isZh ? '系统性能低于预期。请审查数据分布、硬件资源分配和查询执行计划。' : 'Performance below expectations. Review data distribution, hardware allocation, and query execution plans.'
    }
  }
  return map[grade] || map.fair
}

export class ReportGenerator {
  async generateHtmlReport(result: EnhancedTestResult, savePath: string, language: string = 'zh'): Promise<void> {
    const html = this.buildHtml(result, language)
    await writeFile(savePath, html, 'utf-8')
  }

  private buildHtml(result: EnhancedTestResult, language: string): string {
    const { testType, scale, clusterName, summary, queries, flatQueries, flatSummary } = result
    const theme = THEMES[testType] || THEMES.ssb
    const typeLabel = testType.toUpperCase()
    const isZh = language.startsWith('zh')
    const displayLang = isZh ? 'zh' : 'en'
    const dateStr = new Date().toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })

    const coldData = queries.map(q => q.runDetails.coldRun)
    const hotData = queries.map(q => q.runDetails.bestHotRun)
    const hot1Data = queries.map(q => q.runDetails.hotRun1)
    const hot2Data = queries.map(q => q.runDetails.hotRun2)
    const queryIds = queries.map(q => q.queryId)
    const scoreGrade = getScoreGrade(summary.performanceScore)
    const conclusion = getConclusion(scoreGrade, isZh)

    function buildTableRows(qs: EnhancedTestResult['queries']): string {
      return qs.map((q, i) => {
        const hasData = q.runDetails.coldRun > 0
        const avgHot = hasData ? Math.round((q.runDetails.hotRun1 + q.runDetails.hotRun2) / 2) : 0
        const stdDev = hasData ? Math.round(Math.abs(q.runDetails.hotRun1 - q.runDetails.hotRun2) / 2) : 0
        const speedup = hasData && q.runDetails.bestHotRun > 0
          ? (q.runDetails.coldRun / q.runDetails.bestHotRun).toFixed(2)
          : ''
        const rowClass = q.status === 'success' ? 'row-ok' : 'row-err'
        return `<tr class="${rowClass}">
        <td class="col-idx">${i + 1}</td>
        <td class="col-qid"><span>${q.queryId}</span></td>
        <td class="col-num">${hasData ? fmt(q.runDetails.coldRun) : '—'}</td>
        <td class="col-num">${hasData ? fmt(q.runDetails.hotRun1) : '—'}</td>
        <td class="col-num">${hasData ? fmt(q.runDetails.hotRun2) : '—'}</td>
        <td class="col-num col-best">${hasData ? fmt(q.runDetails.bestHotRun) : '—'}</td>
        <td class="col-num">${hasData ? fmt(avgHot) : '—'}</td>
        <td class="col-num">${hasData ? fmt(stdDev) : '—'}</td>
        <td class="col-num col-speedup">${speedup ? speedup + 'x' : '—'}</td>
        <td><span class="tag ${q.status === 'success' ? 'tag-ok' : 'tag-err'}">${q.status === 'success' ? (isZh ? '成功' : 'OK') : (isZh ? '失败' : 'FAIL')}</span></td>
      </tr>`
      }).join('')
    }

    const tableRows = buildTableRows(queries)

    // Build flat query section for SSB
    let flatSectionHtml = ''
    let flatPanelHtml = ''
    let flatColdData: number[] = []
    let flatHotData: number[] = []
    let flatHot1Data: number[] = []
    let flatHot2Data: number[] = []
    let flatQueryIds: string[] = []
    let flatTotalColdRunMs = 0
    let flatTotalHotRunMs = 0
    let flatColdRange = ''
    let flatHotRange = ''
    let flatScoreGrade = 'fair'
    let flatConclusion = getConclusion('fair', isZh)
    let flatTableRows = ''

    if (flatQueries && flatSummary && flatQueries.length > 0) {
      flatColdData = flatQueries.map(q => q.runDetails.coldRun)
      flatHotData = flatQueries.map(q => q.runDetails.bestHotRun)
      flatHot1Data = flatQueries.map(q => q.runDetails.hotRun1)
      flatHot2Data = flatQueries.map(q => q.runDetails.hotRun2)
      flatQueryIds = flatQueries.map(q => q.queryId)
      flatTotalColdRunMs = flatQueries.reduce((s, q) => s + q.runDetails.coldRun, 0)
      flatTotalHotRunMs = flatQueries.reduce((s, q) => s + q.runDetails.bestHotRun, 0)
      flatColdRange = `${flatSummary.minColdRun} — ${flatSummary.maxColdRun} ms`
      flatHotRange = `${flatSummary.minHotRun} — ${flatSummary.maxHotRun} ms`
      flatScoreGrade = getScoreGrade(flatSummary.performanceScore)
      flatConclusion = getConclusion(flatScoreGrade, isZh)
      flatTableRows = buildTableRows(flatQueries)

      flatSectionHtml = `
  <!-- Flat Tab Panel -->
  <div class="tab-bar" id="tabBar">
    <button class="tab-btn active" data-tab="regular">${isZh ? '普通表' : 'Regular'}</button>
    <button class="tab-btn" data-tab="flat">${isZh ? 'Flat 表' : 'Flat Table'}</button>
  </div>

  <div class="tab-panel active" id="tab-regular">`

    } else {
      flatSectionHtml = ''
    }

    // Build the regular section as the first tab panel content
    const regularSectionHtml = `
  <!-- Key Metrics -->
  <div class="sec-title"><div class="line"></div><span data-i18n="metrics">${isZh ? '关键指标' : 'Key Metrics'}</span></div>
  <div class="stats">
    <div class="stat">
      <div class="stat-val accent">${summary.successCount}<span class="unit">/${summary.totalQueries}</span></div>
      <div class="stat-lbl" data-i18n="queries">${isZh ? '成功 / 总数' : 'OK / Total'}</div>
    </div>
    <div class="stat">
      <div class="stat-val ok">${summary.successRate.toFixed(1)}<span class="unit">%</span></div>
      <div class="stat-lbl" data-i18n="successRate">${isZh ? '成功率' : 'Success Rate'}</div>
    </div>
    <div class="stat">
      <div class="stat-val info">${fmt(summary.avgColdRun)}</div>
      <div class="stat-lbl" data-i18n="avgCold">${isZh ? '平均冷启动' : 'Avg Cold Run'}</div>
    </div>
    <div class="stat">
      <div class="stat-val ok">${fmt(summary.avgHotRun)}</div>
      <div class="stat-lbl" data-i18n="avgHot">${isZh ? '平均热缓存' : 'Avg Hot Run'}</div>
    </div>
    <div class="stat">
      <div class="stat-val info">${summary.qps}</div>
      <div class="stat-lbl" data-i18n="qps">${isZh ? '每秒查询数' : 'Queries / sec'}</div>
    </div>
    <div class="stat">
      <div class="stat-val warn">${summary.cacheHitRate.toFixed(1)}<span class="unit">%</span></div>
      <div class="stat-lbl" data-i18n="cacheRate">${isZh ? '缓存命中率' : 'Cache Hit Rate'}</div>
    </div>
  </div>

  <!-- Test Info -->
  <div class="sec-title"><div class="line"></div><span data-i18n="info">${isZh ? '测试信息' : 'Test Information'}</span></div>
  <div class="info-grid">
    <div class="info-item"><span class="lbl" data-i18n="testType">${isZh ? '测试类型' : 'Test Type'}</span><span class="val">${typeLabel}</span></div>
    <div class="info-item"><span class="lbl" data-i18n="scale">${isZh ? '规模因子' : 'Scale Factor'}</span><span class="val">SF ${scale}</span></div>
    <div class="info-item"><span class="lbl" data-i18n="totalCold">${isZh ? '冷启动总耗时' : 'Total Cold Time'}</span><span class="val">${fmt(result.totalColdRunMs)}</span></div>
    <div class="info-item"><span class="lbl" data-i18n="totalHot">${isZh ? '热缓存总耗时' : 'Total Hot Time'}</span><span class="val">${fmt(result.totalHotRunMs)}</span></div>
    <div class="info-item"><span class="lbl" data-i18n="coldStd">${isZh ? '冷启动标准差' : 'Cold StdDev'}</span><span class="val">${summary.coldStdDev} ms</span></div>
    <div class="info-item"><span class="lbl" data-i18n="hotStd">${isZh ? '热缓存标准差' : 'Hot StdDev'}</span><span class="val">${summary.hotStdDev} ms</span></div>
    <div class="info-item"><span class="lbl" data-i18n="coldRange">${isZh ? '冷启动范围' : 'Cold Range'}</span><span class="val">${summary.minColdRun} — ${summary.maxColdRun} ms</span></div>
    <div class="info-item"><span class="lbl" data-i18n="hotRange">${isZh ? '热缓存范围' : 'Hot Range'}</span><span class="val">${summary.minHotRun} — ${summary.maxHotRun} ms</span></div>
  </div>

  	  <!-- Charts -->
	  <div class="sec-title"><div class="line"></div><span data-i18n="charts">${isZh ? '性能图表' : 'Performance Charts'}</span></div>
	  <div class="chart-tab-bar" id="chartTabBar">
	    <button class="chart-tab-btn active" data-chart="bar" data-i18n="chartBar">${isZh ? '冷热耗时' : 'Duration'}</button>
	    <button class="chart-tab-btn" data-chart="line" data-i18n="chartLine">${isZh ? '性能趋势' : 'Trend'}</button>
	    <button class="chart-tab-btn" data-chart="volatility" data-i18n="chartVol">${isZh ? '缓存提升' : 'Speedup'}</button>
	  </div>
	  <div class="charts-container"><div class="chart-panel active" id="chart-bar"><div class="chart-box"><canvas id="barChart"></canvas></div></div>
	  <div class="chart-panel" id="chart-line"><div class="chart-box"><canvas id="lineChart"></canvas></div></div>
	  <div class="chart-panel" id="chart-volatility"><div class="chart-box"><canvas id="volatilityChart"></canvas></div></div></div>

<!-- Query Details -->
  <div class="sec-title"><div class="line"></div><span data-i18n="details">${isZh ? '查询明细' : 'Query Details'}</span></div>
  <div class="table-wrap">
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th class="col-idx">#</th>
            <th data-i18n="colQuery">${isZh ? '查询' : 'Query'}</th>
            <th class="col-num" data-i18n="colCold">${isZh ? '冷启动' : 'Cold'}</th>
            <th class="col-num" data-i18n="colHot1">${isZh ? '热启动1' : 'Hot 1'}</th>
            <th class="col-num" data-i18n="colHot2">${isZh ? '热启动2' : 'Hot 2'}</th>
            <th class="col-num" data-i18n="colBest">${isZh ? '最优热启动' : 'Best Hot'}</th>
            <th class="col-num" data-i18n="colAvg">${isZh ? '平均' : 'Avg'}</th>
            <th class="col-num" data-i18n="colStd">${isZh ? '偏差' : 'StdDev'}</th>
            <th class="col-num" data-i18n="colSpeedup">${isZh ? '加速比' : 'Speedup'}</th>
            <th data-i18n="colStatus">${isZh ? '状态' : 'Status'}</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </div>`

    // Build flat tab panel HTML (full mirror of regular section)
    if (flatQueries && flatSummary && flatQueries.length > 0) {
      flatPanelHtml = `
  </div>
  <div class="tab-panel" id="tab-flat">

  <!-- Flat Key Metrics -->
  <div class="sec-title"><div class="line" style="background: var(--accent2);"></div><span data-i18n="flatMetrics">${isZh ? 'Flat 表关键指标' : 'Flat Table Key Metrics'}</span></div>
  <div class="stats">
    <div class="stat">
      <div class="stat-val accent">${flatSummary.successCount}<span class="unit">/${flatSummary.totalQueries}</span></div>
      <div class="stat-lbl" data-i18n="queries">${isZh ? '成功 / 总数' : 'OK / Total'}</div>
    </div>
    <div class="stat">
      <div class="stat-val ok">${flatSummary.successRate.toFixed(1)}<span class="unit">%</span></div>
      <div class="stat-lbl" data-i18n="successRate">${isZh ? '成功率' : 'Success Rate'}</div>
    </div>
    <div class="stat">
      <div class="stat-val info">${fmt(flatSummary.avgColdRun)}</div>
      <div class="stat-lbl" data-i18n="avgCold">${isZh ? '平均冷启动' : 'Avg Cold Run'}</div>
    </div>
    <div class="stat">
      <div class="stat-val ok">${fmt(flatSummary.avgHotRun)}</div>
      <div class="stat-lbl" data-i18n="avgHot">${isZh ? '平均热缓存' : 'Avg Hot Run'}</div>
    </div>
    <div class="stat">
      <div class="stat-val info">${flatSummary.qps}</div>
      <div class="stat-lbl" data-i18n="qps">${isZh ? '每秒查询数' : 'Queries / sec'}</div>
    </div>
    <div class="stat">
      <div class="stat-val warn">${flatSummary.cacheHitRate.toFixed(1)}<span class="unit">%</span></div>
      <div class="stat-lbl" data-i18n="cacheRate">${isZh ? '缓存命中率' : 'Cache Hit Rate'}</div>
    </div>
  </div>

  <!-- Flat Test Info -->
  <div class="sec-title"><div class="line" style="background: var(--accent2);"></div><span data-i18n="flatInfo">${isZh ? 'Flat 表测试信息' : 'Flat Table Test Info'}</span></div>
  <div class="info-grid">
    <div class="info-item"><span class="lbl" data-i18n="testType">${isZh ? '测试类型' : 'Test Type'}</span><span class="val">${typeLabel}</span></div>
    <div class="info-item"><span class="lbl" data-i18n="scale">${isZh ? '规模因子' : 'Scale Factor'}</span><span class="val">SF ${scale}</span></div>
    <div class="info-item"><span class="lbl" data-i18n="totalCold">${isZh ? '冷启动总耗时' : 'Total Cold Time'}</span><span class="val">${fmt(flatTotalColdRunMs)}</span></div>
    <div class="info-item"><span class="lbl" data-i18n="totalHot">${isZh ? '热缓存总耗时' : 'Total Hot Time'}</span><span class="val">${fmt(flatTotalHotRunMs)}</span></div>
    <div class="info-item"><span class="lbl" data-i18n="coldStd">${isZh ? '冷启动标准差' : 'Cold StdDev'}</span><span class="val">${flatSummary.coldStdDev} ms</span></div>
    <div class="info-item"><span class="lbl" data-i18n="hotStd">${isZh ? '热缓存标准差' : 'Hot StdDev'}</span><span class="val">${flatSummary.hotStdDev} ms</span></div>
    <div class="info-item"><span class="lbl" data-i18n="coldRange">${isZh ? '冷启动范围' : 'Cold Range'}</span><span class="val">${flatColdRange}</span></div>
    <div class="info-item"><span class="lbl" data-i18n="hotRange">${isZh ? '热缓存范围' : 'Hot Range'}</span><span class="val">${flatHotRange}</span></div>
  </div>

  	  <!-- Flat Charts -->
	  <div class="sec-title"><div class="line" style="background: var(--accent2);"></div><span data-i18n="flatCharts">${isZh ? 'Flat 表性能图表' : 'Flat Table Charts'}</span></div>
	  <div class="chart-tab-bar" id="flatChartTabBar">
	    <button class="chart-tab-btn active" data-fchart="bar" data-i18n="chartBar">${isZh ? '冷热耗时' : 'Duration'}</button>
	    <button class="chart-tab-btn" data-fchart="line" data-i18n="chartLine">${isZh ? '性能趋势' : 'Trend'}</button>
	    <button class="chart-tab-btn" data-fchart="volatility" data-i18n="chartVol">${isZh ? '缓存提升' : 'Speedup'}</button>
	  </div>
	  <div class="charts-container"><div class="chart-panel active" id="fchart-bar"><div class="chart-box"><canvas id="flatBarChart"></canvas></div></div>
	  <div class="chart-panel" id="fchart-line"><div class="chart-box"><canvas id="flatLineChart"></canvas></div></div>
	  <div class="chart-panel" id="fchart-volatility"><div class="chart-box"><canvas id="flatVolatilityChart"></canvas></div></div></div>

<!-- Flat Query Details -->
  <div class="sec-title"><div class="line" style="background: var(--accent2);"></div><span data-i18n="flatDetails">${isZh ? 'Flat 表查询明细' : 'Flat Table Details'}</span></div>
  <div class="table-wrap">
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th class="col-idx">#</th>
            <th data-i18n="colQuery">${isZh ? '查询' : 'Query'}</th>
            <th class="col-num" data-i18n="colCold">${isZh ? '冷启动' : 'Cold'}</th>
            <th class="col-num" data-i18n="colHot1">${isZh ? '热启动1' : 'Hot 1'}</th>
            <th class="col-num" data-i18n="colHot2">${isZh ? '热启动2' : 'Hot 2'}</th>
            <th class="col-num" data-i18n="colBest">${isZh ? '最优热启动' : 'Best Hot'}</th>
            <th class="col-num" data-i18n="colAvg">${isZh ? '平均' : 'Avg'}</th>
            <th class="col-num" data-i18n="colStd">${isZh ? '偏差' : 'StdDev'}</th>
            <th class="col-num" data-i18n="colSpeedup">${isZh ? '加速比' : 'Speedup'}</th>
            <th data-i18n="colStatus">${isZh ? '状态' : 'Status'}</th>
          </tr>
        </thead>
        <tbody>${flatTableRows}</tbody>
      </table>
    </div>
  </div>
  </div>`
    }

    return `<!DOCTYPE html>
<html lang="${displayLang === 'zh' ? 'zh-CN' : 'en'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${typeLabel} ${isZh ? '基准测试报告' : 'Benchmark Report'} — ${clusterName}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
  :root {
    --bg: #09090b;
    --bg-elevated: #18181b;
    --bg-card: rgba(24, 24, 27, 0.7);
    --border: rgba(255, 255, 255, 0.06);
    --border-strong: rgba(255, 255, 255, 0.1);
    --text: #fafafa;
    --text-secondary: #a1a1aa;
    --text-muted: #71717a;
    --accent: ${theme.accentPrimary};
    --accent2: ${theme.accentSecondary};
    --accent-muted: ${theme.accentMuted};
    --glow: ${theme.surfaceGlow};
    --ok: #10b981;
    --ok-bg: rgba(16, 185, 129, 0.08);
    --err: #f43f5e;
    --err-bg: rgba(244, 63, 94, 0.08);
    --warn: #f59e0b;
    --radius: 8px;
    --radius-lg: 14px;
    --font: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    --mono: 'JetBrains Mono', 'Fira Code', monospace;
  }

  [data-theme="light"] {
    --bg: #fafafa;
    --bg-elevated: #ffffff;
    --bg-card: rgba(255, 255, 255, 0.85);
    --border: rgba(0, 0, 0, 0.06);
    --border-strong: rgba(0, 0, 0, 0.1);
    --text: #09090b;
    --text-secondary: #52525b;
    --text-muted: #a1a1aa;
    --ok-bg: rgba(16, 185, 129, 0.06);
    --err-bg: rgba(244, 63, 94, 0.06);
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    transition: background 0.3s, color 0.3s;
  }

  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 50% -30%, var(--glow), transparent),
      radial-gradient(ellipse 30% 50% at 90% 100%, var(--accent-muted), transparent);
    pointer-events: none;
    z-index: 0;
  }

  .wrap {
    position: relative;
    z-index: 1;
    max-width: 1340px;
    margin: 0 auto;
    padding: 40px 32px 64px;
  }

  /* ── Toolbar ── */
  .toolbar {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-bottom: 24px;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid var(--border-strong);
    background: var(--bg-elevated);
    color: var(--text-secondary);
    font-family: var(--font);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
  }

  .pill:hover { border-color: var(--accent); color: var(--text); }
  .pill.on { background: var(--accent); border-color: var(--accent); color: #fff; }

  .pill-group { display: flex; gap: 2px; }
  .pill-group .pill:first-child { border-radius: 999px 0 0 999px; }
  .pill-group .pill:last-child { border-radius: 0 999px 999px 0; }
  .pill-group .pill:not(:first-child) { margin-left: -1px; }

  .sep { width: 1px; background: var(--border-strong); margin: 0 6px; align-self: stretch; }

  /* ── Tabs ── */
  .tab-bar {
    display: flex;
    gap: 0;
    margin-bottom: 32px;
    border-bottom: 2px solid var(--border);
  }
  .tab-btn {
    padding: 10px 24px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-family: var(--font);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: all 0.2s;
    user-select: none;
  }
  .tab-btn:hover { color: var(--text-secondary); }
  .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }

  /* ── Hero ── */
  .hero {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 32px;
    flex-wrap: wrap;
    margin-bottom: 40px;
    padding-bottom: 32px;
    border-bottom: 1px solid var(--border);
  }

  .hero-left h1 {
    font-family: var(--font);
    font-size: clamp(1.6rem, 3.5vw, 2.2rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text);
    margin-bottom: 4px;
  }

  .hero-left h1 span {
    background: ${theme.heroGradient};
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-left .sub {
    font-size: 14px;
    color: var(--text-muted);
    margin-bottom: 16px;
  }

  .hero-tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .hero-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg-elevated);
    font-family: var(--mono);
    font-size: 11px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .hero-tag .dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--accent);
  }

  .hero-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  /* ── Section heading ── */
  .sec-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
  }

  .sec-title .line {
    width: 24px;
    height: 2px;
    border-radius: 1px;
    background: var(--accent);
  }

  .sec-title span {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  /* ── Stat cards ── */
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 10px;
    margin-bottom: 40px;
  }

  .stat {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 20px 22px;
    backdrop-filter: blur(10px);
    transition: border-color 0.25s;
  }

  .stat:hover { border-color: var(--border-strong); }

  .stat-val {
    font-family: var(--mono);
    font-size: clamp(1.5rem, 2.5vw, 2rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin-bottom: 2px;
  }

  .stat-val.accent { color: var(--accent); }
  .stat-val.ok { color: var(--ok); }
  .stat-val.warn { color: var(--warn); }
  .stat-val.info { color: var(--accent2); }

  .stat-val .unit {
    font-size: 0.45em;
    font-weight: 500;
    opacity: 0.5;
  }

  .stat-lbl {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* ── Info grid ── */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 8px;
    margin-bottom: 40px;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg-card);
    font-size: 13px;
  }

  .info-item .lbl { color: var(--text-muted); font-weight: 500; font-size: 11px; letter-spacing: 0.03em; text-transform: uppercase; }
  .info-item .val { font-family: var(--mono); font-weight: 600; font-size: 13px; color: var(--text); }

  /* ── Charts ── */
  .chart-tab-bar {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
  }
  .chart-tab-btn {
    padding: 4px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: var(--text-muted);
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
  }
  .chart-tab-btn:hover { border-color: var(--border-strong); color: var(--text-secondary); }
  .chart-tab-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .charts-container { position: relative; min-height: 350px; margin-bottom: 24px; }
  .chart-panel { display: none; }
  .chart-panel.active { display: block; }
  .chart-box {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 20px;
    min-height: 320px;
  }
  .chart-box canvas { max-height: 420px; }

  /* ── Table ── */
  .table-wrap {
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    margin-bottom: 40px;
    background: var(--bg-card);
  }

  .table-scroll {
    max-height: 520px;
    overflow-y: auto;
  }

  .table-scroll::-webkit-scrollbar { width: 4px; }
  .table-scroll::-webkit-scrollbar-track { background: transparent; }
  .table-scroll::-webkit-scrollbar-thumb { background: var(--text-muted); border-radius: 2px; }

  table { width: 100%; border-collapse: collapse; font-size: 13px; }

  thead { position: sticky; top: 0; z-index: 5; }

  th {
    text-align: left;
    padding: 12px 16px;
    font-family: var(--font);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border-strong);
    white-space: nowrap;
  }

  td {
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  tr:hover td { background: rgba(128, 128, 128, 0.04); }

  .col-idx { color: var(--text-muted); width: 36px; }
  .col-qid span { font-weight: 600; color: var(--text); }
  .col-num { text-align: right; }
  .col-best { color: var(--ok); font-weight: 600; }
  .col-speedup { color: var(--accent); font-weight: 600; }

  .row-err td { opacity: 0.45; }

  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-family: var(--font);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .tag-ok { background: var(--ok-bg); color: var(--ok); }
  .tag-err { background: var(--err-bg); color: var(--err); }

  /* ── Score ── */
  .score-section {
    display: flex;
    align-items: center;
    gap: 32px;
    flex-wrap: wrap;
    margin-bottom: 40px;
    padding: 28px 32px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
  }

  .score-ring {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-family: var(--mono);
    font-weight: 700;
    flex-shrink: 0;
  }

  .score-ring .num { font-size: 1.9rem; line-height: 1; }
  .score-ring .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.8; margin-top: 1px; }

  .score-ring.excellent { background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 0 28px rgba(16,185,129,0.25); }
  .score-ring.good { background: linear-gradient(135deg, var(--accent), var(--accent2)); box-shadow: 0 0 28px rgba(99,102,241,0.2); }
  .score-ring.fair { background: linear-gradient(135deg, #f59e0b, #d97706); box-shadow: 0 0 28px rgba(245,158,11,0.2); }
  .score-ring.poor { background: linear-gradient(135deg, #f43f5e, #e11d48); box-shadow: 0 0 28px rgba(244,63,94,0.2); }

  .score-text h3 { font-size: 1.05rem; font-weight: 600; margin-bottom: 6px; color: var(--text); }
  .score-text p { font-size: 13px; color: var(--text-secondary); line-height: 1.7; max-width: 560px; }

  /* ── Footer ── */
  .footer {
    text-align: center;
    padding-top: 24px;
    border-top: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 11px;
    font-family: var(--mono);
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .wrap { padding: 24px 16px 40px; }
    .hero { flex-direction: column; gap: 20px; }
    .hero-right { align-items: flex-start; }
    .stats { grid-template-columns: repeat(2, 1fr); }
    .charts { grid-template-columns: 1fr; }
    .score-section { flex-direction: column; text-align: center; }
    .score-text p { max-width: 100%; }
    .chart-box { min-height: 260px; }
  }

  @media (max-width: 480px) {
    .stats { grid-template-columns: 1fr; }
    .info-grid { grid-template-columns: 1fr; }
  }

  @media print {
    body { background: #fff; color: #000; }
    body::before { display: none; }
    .toolbar { display: none; }
    .wrap { padding: 20px; }
    .stat, .chart-box, .score-section, .info-item, .table-wrap {
      background: #fff; border: 1px solid #e5e5e5; box-shadow: none;
    }
  }
</style>
</head>
<body data-theme="light">
<div class="wrap">

  <!-- Toolbar -->
  <div class="toolbar">
    <div class="pill-group" id="langGroup">
      <button class="pill on" data-lang="zh">中文</button>
      <button class="pill" data-lang="en">EN</button>
    </div>
    <div class="sep"></div>
    <div class="pill-group" id="themeGroup">
      <button class="pill on" data-theme="light">Light</button>
      <button class="pill" data-theme="dark">Dark</button>
    </div>
  </div>

  <!-- Hero -->
  <div class="hero">
    <div class="hero-left">
      <h1><span data-zh="${theme.title.zh}" data-en="${theme.title.en}">${isZh ? theme.title.zh : theme.title.en}</span></h1>
      <p class="sub" data-zh="${theme.description.zh}" data-en="${theme.description.en}">${isZh ? theme.description.zh : theme.description.en}</p>
      <div class="hero-tags">
        <div class="hero-tag"><span class="dot"></span>${clusterName}</div>
        <div class="hero-tag">SF ${scale}</div>
        <div class="hero-tag">${typeLabel}</div>
        <div class="hero-tag">${dateStr}</div>
      </div>
    </div>
  </div>

  ${flatSectionHtml}
  ${regularSectionHtml}
  ${flatPanelHtml}

  <div class="footer">Doris Benchmark Tool &middot; ${new Date().toISOString()}</div>
</div>

<script>
  const Q = ${JSON.stringify(queryIds)};
  const cold = ${JSON.stringify(coldData)};
  const hot1 = ${JSON.stringify(hot1Data)};
  const hot2 = ${JSON.stringify(hot2Data)};
  const hot = ${JSON.stringify(hotData)};
  const colors = ${JSON.stringify(theme.chartColors)};${flatQueries && flatSummary && flatQueries.length > 0 ? `
  const flatQ = ${JSON.stringify(flatQueryIds)};
  const flatCold = ${JSON.stringify(flatColdData)};
  const flatHot1 = ${JSON.stringify(flatHot1Data)};
  const flatHot2 = ${JSON.stringify(flatHot2Data)};
  const flatHot = ${JSON.stringify(flatHotData)};` : ''}

  const i18n = {
    zh: {
      metrics:'关键指标', queries:'成功 / 总数', successRate:'成功率', avgCold:'平均冷启动', avgHot:'平均热缓存',
      qps:'每秒查询数', cacheRate:'缓存命中率',
      info:'测试信息', testType:'测试类型', scale:'规模因子', totalCold:'冷启动总耗时', totalHot:'热缓存总耗时',
      coldStd:'冷启动标准差', hotStd:'热缓存标准差', coldRange:'冷启动范围', hotRange:'热缓存范围',
      charts:'性能图表', details:'查询明细',
      colQuery:'查询', colCold:'冷启动', colHot1:'热启动1', colHot2:'热启动2', colBest:'最优热启动',
      colAvg:'平均', colStd:'偏差', colSpeedup:'加速比', colStatus:'状态',
      barTitle:'查询执行耗时对比 (ms)',
      lineTitle:'冷热性能趋势',
      volTitle:'缓存性能提升 (%)',
      flatMetrics:'Flat 表关键指标', flatInfo:'Flat 表测试信息', flatCharts:'Flat 表性能图表', flatDetails:'Flat 表查询明细',
      chartBar:'冷热耗时', chartLine:'性能趋势', chartVol:'缓存提升'
    },
    en: {
      metrics:'Key Metrics', queries:'OK / Total', successRate:'Success Rate', avgCold:'Avg Cold Run', avgHot:'Avg Hot Run',
      qps:'Queries / sec', cacheRate:'Cache Hit Rate',
      info:'Test Information', testType:'Test Type', scale:'Scale Factor', totalCold:'Total Cold Time', totalHot:'Total Hot Time',
      coldStd:'Cold StdDev', hotStd:'Hot StdDev', coldRange:'Cold Range', hotRange:'Hot Range',
      charts:'Performance Charts', details:'Query Details',
      colQuery:'Query', colCold:'Cold', colHot1:'Hot 1', colHot2:'Hot 2', colBest:'Best Hot',
      colAvg:'Avg', colStd:'StdDev', colSpeedup:'Speedup', colStatus:'Status',
      barTitle:'Query Execution Time (ms)',
      lineTitle:'Cold vs Hot Trend',
      volTitle:'Cache Improvement (%)',
      flatMetrics:'Flat Table Key Metrics', flatInfo:'Flat Table Test Info', flatCharts:'Flat Table Charts', flatDetails:'Flat Table Details',
      chartBar:'Duration', chartLine:'Trend', chartVol:'Speedup'
    }
  };

  let lang = '${displayLang}';
  let mode = 'light';
  let charts = {};

  function t(k) { return (i18n[lang] || i18n.en)[k] || k; }

  function gridColor() {
    return mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  }

  function setLang(l) {
    lang = l;
    document.querySelectorAll('#langGroup .pill').forEach(b => b.classList.toggle('on', b.dataset.lang === l));
    document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
    // Hero title & subtitle
    const heroTitle = document.querySelector('.hero-left h1 span');
    if (heroTitle) heroTitle.textContent = heroTitle.dataset[lang === 'zh' ? 'zh' : 'en'] || heroTitle.textContent;
    const heroSub = document.querySelector('.hero-left .sub');
    if (heroSub) heroSub.textContent = heroSub.dataset[lang === 'zh' ? 'zh' : 'en'] || heroSub.textContent;
    // Update chart tab buttons
    document.querySelectorAll('.chart-tab-btn[data-i18n]').forEach(btn => {
      btn.textContent = t(btn.dataset.i18n);
    });
    // Chart titles
    const chartTitleKeys = { barChart:'barTitle', lineChart:'lineTitle', volatilityChart:'volTitle' };
    Object.keys(chartTitleKeys).forEach(id => {
      if (charts[id]) { charts[id].options.plugins.title.text = t(chartTitleKeys[id]); charts[id].update(); }
    });
    // Regular chart labels
    if (charts.barChart) {
      charts.barChart.data.datasets[0].label = lang === 'zh' ? '冷启动' : 'Cold';
      charts.barChart.data.datasets[1].label = lang === 'zh' ? '热缓存1' : 'Hot 1';
      charts.barChart.data.datasets[2].label = lang === 'zh' ? '热缓存2' : 'Hot 2';
      charts.barChart.update();
    }
    if (charts.lineChart) {
      charts.lineChart.data.datasets[0].label = lang === 'zh' ? '冷启动' : 'Cold';
      charts.lineChart.data.datasets[1].label = lang === 'zh' ? '最优热启动' : 'Best Hot';
      charts.lineChart.update();
    }
    if (charts.volatilityChart) {
      charts.volatilityChart.data.datasets[0].label = lang === 'zh' ? '缓存提升 %' : 'Improvement %';
      charts.volatilityChart.update();
    }
    // Flat chart titles & labels
    if (charts.flatBarChart) {
      charts.flatBarChart.data.datasets[0].label = lang === 'zh' ? '冷启动' : 'Cold';
      charts.flatBarChart.data.datasets[1].label = lang === 'zh' ? '热缓存1' : 'Hot 1';
      charts.flatBarChart.data.datasets[2].label = lang === 'zh' ? '热缓存2' : 'Hot 2';
      charts.flatBarChart.options.plugins.title.text = (lang === 'zh' ? 'Flat 表查询耗时对比' : 'Flat Table Query Times') + ' (ms)';
      charts.flatBarChart.update();
    }
    if (charts.flatLineChart) {
      charts.flatLineChart.data.datasets[0].label = lang === 'zh' ? '冷启动' : 'Cold';
      charts.flatLineChart.data.datasets[1].label = lang === 'zh' ? '最优热启动' : 'Best Hot';
      charts.flatLineChart.options.plugins.title.text = (lang === 'zh' ? 'Flat 表冷热趋势' : 'Flat Cold vs Hot Trend');
      charts.flatLineChart.update();
    }
    if (charts.flatVolatilityChart) {
      charts.flatVolatilityChart.data.datasets[0].label = lang === 'zh' ? '缓存提升 %' : 'Improvement %';
      charts.flatVolatilityChart.options.plugins.title.text = (lang === 'zh' ? 'Flat 表缓存提升' : 'Flat Cache Improvement') + ' (%)';
      charts.flatVolatilityChart.update();
    }
  }function setTheme(th) {
    mode = th;
    document.body.setAttribute('data-theme', th);
    document.querySelectorAll('#themeGroup .pill').forEach(b => b.classList.toggle('on', b.dataset.theme === th));
    Chart.defaults.color = th === 'dark' ? '#a1a1aa' : '#52525b';
    Object.values(charts).forEach(ch => {
      if (ch.options && ch.options.scales) {
        Object.values(ch.options.scales).forEach(s => { if (s.grid) s.grid.color = gridColor(); });
      }
      ch.update();
    });
  }

  Chart.defaults.color = '#52525b';
  Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(24,24,27,0.95)';
  Chart.defaults.plugins.tooltip.titleFont = { family: "'JetBrains Mono', monospace", size: 11 };
  Chart.defaults.plugins.tooltip.bodyFont = { family: "'JetBrains Mono', monospace", size: 10 };

  // Temporarily show all chart panels so Chart.js can read proper canvas dimensions
  document.querySelectorAll('.chart-panel').forEach(function(p) { p.classList.add('active'); });

  // Bar chart
  charts.barChart = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: Q,
      datasets: [
        { label: lang === 'zh' ? '冷启动' : 'Cold', data: cold, backgroundColor: colors[0], borderRadius: 3, borderWidth: 0, barPercentage: 0.85 },
        { label: lang === 'zh' ? '热缓存1' : 'Hot 1', data: hot1, backgroundColor: colors[1], borderRadius: 3, borderWidth: 0, barPercentage: 0.85 },
        { label: lang === 'zh' ? '热缓存2' : 'Hot 2', data: hot2, backgroundColor: colors[2], borderRadius: 3, borderWidth: 0, barPercentage: 0.85 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { title: { display: true, text: t('barTitle'), font: { size: 11, weight: '600' }, color: Chart.defaults.color }, legend: { position: 'top', labels: { boxWidth: 8, padding: 14, font: { size: 10 }, usePointStyle: true } } },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { font: { size: 9, family: "'JetBrains Mono', monospace" } } },
        y: { beginAtZero: true, grid: { color: gridColor() }, ticks: { font: { size: 9, family: "'JetBrains Mono', monospace" }, callback: v => v + 'ms' } }
      }
    }
  });

  // Line chart
  charts.lineChart = new Chart(document.getElementById('lineChart'), {
    type: 'line',
    data: {
      labels: Q,
      datasets: [
        { label: lang === 'zh' ? '冷启动' : 'Cold', data: cold, borderColor: colors[0], backgroundColor: colors[0].replace('0.85)', '0.08)'), fill: true, tension: 0.35, borderWidth: 1.5, pointRadius: 2, pointHoverRadius: 4 },
        { label: lang === 'zh' ? '最优热启动' : 'Best Hot', data: hot, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', fill: true, tension: 0.35, borderWidth: 1.5, pointRadius: 2, pointHoverRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { title: { display: true, text: t('lineTitle'), font: { size: 11, weight: '600' } }, legend: { position: 'top', labels: { boxWidth: 8, padding: 14, font: { size: 10 }, usePointStyle: true } } },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { font: { size: 9, family: "'JetBrains Mono', monospace" } } },
        y: { beginAtZero: true, grid: { color: gridColor() }, ticks: { font: { size: 9, family: "'JetBrains Mono', monospace" }, callback: v => v + 'ms' } }
      }
    }
  });

  // Volatility
  const volData = cold.map((c, i) => c > 0 ? Math.round((c - hot[i]) / c * 100) : 0);
  charts.volatilityChart = new Chart(document.getElementById('volatilityChart'), {
    type: 'bar',
    data: {
      labels: Q,
      datasets: [{
        label: lang === 'zh' ? '缓存提升 %' : 'Improvement %',
        data: volData,
        backgroundColor: volData.map(v => v > 25 ? 'rgba(16,185,129,0.7)' : v > 10 ? 'rgba(245,158,11,0.65)' : 'rgba(244,63,94,0.55)'),
        borderRadius: 3, borderWidth: 0, barPercentage: 0.8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { title: { display: true, text: t('volTitle'), font: { size: 11, weight: '600' } }, legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { font: { size: 9, family: "'JetBrains Mono', monospace" } } },
        y: { beginAtZero: true, grid: { color: gridColor() }, ticks: { font: { size: 9, family: "'JetBrains Mono', monospace" }, callback: v => v + '%' } }
      }
    }
  });

  // Flat table charts (SSB only)
  if (typeof flatQ !== 'undefined' && flatQ.length > 0) {
    charts.flatBarChart = new Chart(document.getElementById('flatBarChart'), {
      type: 'bar',
      data: {
        labels: flatQ,
        datasets: [
          { label: lang === 'zh' ? '冷启动' : 'Cold', data: flatCold, backgroundColor: colors[0], borderRadius: 3, borderWidth: 0, barPercentage: 0.85 },
          { label: lang === 'zh' ? '热缓存1' : 'Hot 1', data: flatHot1, backgroundColor: colors[1], borderRadius: 3, borderWidth: 0, barPercentage: 0.85 },
          { label: lang === 'zh' ? '热缓存2' : 'Hot 2', data: flatHot2, backgroundColor: colors[2], borderRadius: 3, borderWidth: 0, barPercentage: 0.85 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: true, text: (lang === 'zh' ? 'Flat 表查询耗时对比' : 'Flat Table Query Times') + ' (ms)', font: { size: 11, weight: '600' }, color: Chart.defaults.color }, legend: { position: 'top', labels: { boxWidth: 8, padding: 14, font: { size: 10 }, usePointStyle: true } } },
        scales: {
          x: { grid: { color: gridColor() }, ticks: { font: { size: 9, family: "'JetBrains Mono', monospace" } } },
          y: { beginAtZero: true, grid: { color: gridColor() }, ticks: { font: { size: 9, family: "'JetBrains Mono', monospace" }, callback: v => v + 'ms' } }
        }
      }
    });

    charts.flatLineChart = new Chart(document.getElementById('flatLineChart'), {
      type: 'line',
      data: {
        labels: flatQ,
        datasets: [
          { label: lang === 'zh' ? '冷启动' : 'Cold', data: flatCold, borderColor: colors[0], backgroundColor: colors[0].replace('0.85)', '0.08)'), fill: true, tension: 0.35, borderWidth: 1.5, pointRadius: 2, pointHoverRadius: 4 },
          { label: lang === 'zh' ? '最优热启动' : 'Best Hot', data: flatHot, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', fill: true, tension: 0.35, borderWidth: 1.5, pointRadius: 2, pointHoverRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: true, text: (lang === 'zh' ? 'Flat 表冷热趋势' : 'Flat Cold vs Hot Trend'), font: { size: 11, weight: '600' } }, legend: { position: 'top', labels: { boxWidth: 8, padding: 14, font: { size: 10 }, usePointStyle: true } } },
        scales: {
          x: { grid: { color: gridColor() }, ticks: { font: { size: 9, family: "'JetBrains Mono', monospace" } } },
          y: { beginAtZero: true, grid: { color: gridColor() }, ticks: { font: { size: 9, family: "'JetBrains Mono', monospace" }, callback: v => v + 'ms' } }
        }
      }
    });

    const flatVolData = flatCold.map((c, i) => c > 0 ? Math.round((c - flatHot[i]) / c * 100) : 0);
    charts.flatVolatilityChart = new Chart(document.getElementById('flatVolatilityChart'), {
      type: 'bar',
      data: {
        labels: flatQ,
        datasets: [{
          label: lang === 'zh' ? '缓存提升 %' : 'Improvement %',
          data: flatVolData,
          backgroundColor: flatVolData.map(v => v > 25 ? 'rgba(16,185,129,0.7)' : v > 10 ? 'rgba(245,158,11,0.65)' : 'rgba(244,63,94,0.55)'),
          borderRadius: 3, borderWidth: 0, barPercentage: 0.8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: true, text: (lang === 'zh' ? 'Flat 表缓存提升' : 'Flat Cache Improvement') + ' (%)', font: { size: 11, weight: '600' } }, legend: { display: false } },
        scales: {
          x: { grid: { color: gridColor() }, ticks: { font: { size: 9, family: "'JetBrains Mono', monospace" } } },
          y: { beginAtZero: true, grid: { color: gridColor() }, ticks: { font: { size: 9, family: "'JetBrains Mono', monospace" }, callback: v => v + '%' } }
        }
      }
    });
    }

    // Restore default panel visibility (only bar panels active)
    document.querySelectorAll('#chart-line, #chart-volatility, #fchart-line, #fchart-volatility').forEach(function(p) { p.classList.remove('active'); });
    // Chart tab switching (regular)
    document.querySelectorAll('#chartTabBar .chart-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.chart;
        document.querySelectorAll('#chartTabBar .chart-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.chart === target));
        document.querySelectorAll('#chart-bar, #chart-line, #chart-volatility').forEach(p => p.classList.toggle('active', p.id === 'chart-' + target));
        const chartMap = { bar: 'barChart', line: 'lineChart', volatility: 'volatilityChart' };
        setTimeout(() => { if (charts[chartMap[target]]) charts[chartMap[target]].resize(); }, 50);
      });
    });

    // Chart tab switching (flat)
    if (document.getElementById('flatChartTabBar')) {
      document.querySelectorAll('#flatChartTabBar .chart-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const target = btn.dataset.fchart;
          document.querySelectorAll('#flatChartTabBar .chart-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.fchart === target));
          document.querySelectorAll('#fchart-bar, #fchart-line, #fchart-volatility').forEach(p => p.classList.toggle('active', p.id === 'fchart-' + target));
          const fmap = { bar: 'flatBarChart', line: 'flatLineChart', volatility: 'flatVolatilityChart' };
          setTimeout(() => { if (charts[fmap[target]]) charts[fmap[target]].resize(); }, 50);
        });
      });
    }

    // Tab switching (table)
    document.querySelectorAll('#tabBar .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        document.querySelectorAll('#tabBar .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === targetTab));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + targetTab));
        // Resize charts after switching
        setTimeout(() => {
          Object.values(charts).forEach(ch => { if (ch && ch.resize) ch.resize(); });
        }, 50);
      });
    });

  // Event binding
  document.querySelectorAll('#langGroup .pill').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  document.querySelectorAll('#themeGroup .pill').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.theme)));
<\/script>
</body>
</html>`
  }
}
