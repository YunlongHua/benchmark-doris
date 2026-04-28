import { EnhancedTestResult, EnhancedQueryResult, TestSummary, QueryRunDetail } from '../../src/types'

export class ResultParser {
  parseEnhancedResult(
    testType: string,
    scale: number,
    clusterName: string,
    queryData?: { queryId: string; coldRun: number; hotRun1: number; hotRun2: number; bestHotRun: number }[],
    flatQueryData?: { queryId: string; coldRun: number; hotRun1: number; hotRun2: number; bestHotRun: number }[]
  ): EnhancedTestResult {
    const queries = this.buildQueryResults(testType, queryData || [])

    const totalColdRunMs = queries.reduce((sum, q) => sum + q.runDetails.coldRun, 0)
    const totalHotRunMs = queries.reduce((sum, q) => sum + q.runDetails.bestHotRun, 0)

    const successCount = queries.filter(q => q.status === 'success').length
    const failedCount = queries.filter(q => q.status === 'error').length

    const coldRuns = queries.map(q => q.runDetails.coldRun).filter(t => t > 0)
    const hotRuns = queries.map(q => q.runDetails.bestHotRun).filter(t => t > 0)

    const avgColdRun = coldRuns.length > 0 ? coldRuns.reduce((a, b) => a + b, 0) / coldRuns.length : 0
    const avgHotRun = hotRuns.length > 0 ? hotRuns.reduce((a, b) => a + b, 0) / hotRuns.length : 0
    const minColdRun = coldRuns.length > 0 ? Math.min(...coldRuns) : 0
    const maxColdRun = coldRuns.length > 0 ? Math.max(...coldRuns) : 0
    const minHotRun = hotRuns.length > 0 ? Math.min(...hotRuns) : 0
    const maxHotRun = hotRuns.length > 0 ? Math.max(...hotRuns) : 0

    const coldStdDev = this.calculateStdDev(coldRuns, avgColdRun)
    const hotStdDev = this.calculateStdDev(hotRuns, avgHotRun)

    const totalTime = totalHotRunMs / 1000
    const qps = totalTime > 0 ? queries.length / totalTime : 0

    const cacheHitRate = totalColdRunMs > 0
      ? Math.max(0, ((totalColdRunMs - totalHotRunMs) / totalColdRunMs) * 100)
      : 0

    const performanceScore = this.calculatePerformanceScore(avgColdRun, avgHotRun, hotStdDev, queries.length)

    const summary: TestSummary = {
      totalQueries: queries.length,
      successCount,
      failedCount,
      successRate: queries.length > 0 ? (successCount / queries.length) * 100 : 0,
      avgColdRun: Math.round(avgColdRun),
      avgHotRun: Math.round(avgHotRun),
      minColdRun,
      maxColdRun,
      minHotRun,
      maxHotRun,
      coldStdDev: Math.round(coldStdDev),
      hotStdDev: Math.round(hotStdDev),
      qps: Math.round(qps * 100) / 100,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      performanceScore: Math.round(performanceScore * 100) / 100
    }

    let flatQueries: EnhancedQueryResult[] | undefined
    let flatSummary: TestSummary | undefined

    if (flatQueryData && flatQueryData.length > 0) {
      flatQueries = this.buildQueryResults(testType, flatQueryData)

      const flatTotalCold = flatQueries.reduce((sum, q) => sum + q.runDetails.coldRun, 0)
      const flatTotalHot = flatQueries.reduce((sum, q) => sum + q.runDetails.bestHotRun, 0)
      const flatSuccess = flatQueries.filter(q => q.status === 'success').length
      const flatFailed = flatQueries.filter(q => q.status === 'error').length
      const flatColdVals = flatQueries.map(q => q.runDetails.coldRun).filter(t => t > 0)
      const flatHotVals = flatQueries.map(q => q.runDetails.bestHotRun).filter(t => t > 0)
      const flatAvgCold = flatColdVals.length > 0 ? flatColdVals.reduce((a, b) => a + b, 0) / flatColdVals.length : 0
      const flatAvgHot = flatHotVals.length > 0 ? flatHotVals.reduce((a, b) => a + b, 0) / flatHotVals.length : 0
      const flatColdStd = this.calculateStdDev(flatColdVals, flatAvgCold)
      const flatHotStd = this.calculateStdDev(flatHotVals, flatAvgHot)
      const flatTotalTime = flatTotalHot / 1000
      const flatQps = flatTotalTime > 0 ? flatQueries.length / flatTotalTime : 0
      const flatCacheRate = flatTotalCold > 0 ? Math.max(0, ((flatTotalCold - flatTotalHot) / flatTotalCold) * 100) : 0
      const flatPerfScore = this.calculatePerformanceScore(flatAvgCold, flatAvgHot, flatHotStd, flatQueries.length)

      flatSummary = {
        totalQueries: flatQueries.length,
        successCount: flatSuccess,
        failedCount: flatFailed,
        successRate: flatQueries.length > 0 ? (flatSuccess / flatQueries.length) * 100 : 0,
        avgColdRun: Math.round(flatAvgCold),
        avgHotRun: Math.round(flatAvgHot),
        minColdRun: flatColdVals.length > 0 ? Math.min(...flatColdVals) : 0,
        maxColdRun: flatColdVals.length > 0 ? Math.max(...flatColdVals) : 0,
        minHotRun: flatHotVals.length > 0 ? Math.min(...flatHotVals) : 0,
        maxHotRun: flatHotVals.length > 0 ? Math.max(...flatHotVals) : 0,
        coldStdDev: Math.round(flatColdStd),
        hotStdDev: Math.round(flatHotStd),
        qps: Math.round(flatQps * 100) / 100,
        cacheHitRate: Math.round(flatCacheRate * 100) / 100,
        performanceScore: Math.round(flatPerfScore * 100) / 100
      }
    }

    return {
      testType: testType as 'ssb' | 'tpch' | 'tpcds',
      scale,
      clusterName,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      totalDurationMs: totalColdRunMs,
      totalColdRunMs,
      totalHotRunMs,
      queries,
      summary,
      flatQueries,
      flatSummary
    }
  }

parseQueryDataFromLogs(logLines: string[], testType: string): { queryId: string; coldRun: number; hotRun1: number; hotRun2: number; bestHotRun: number }[] {
    const results: { queryId: string; coldRun: number; hotRun1: number; hotRun2: number; bestHotRun: number }[] = []

    // Script output format (echo -ne with TAB separators):
    //   SSB:   q1.1\t<cold>\t<hot1>\t<hot2>\t<best>
    //   TPCH:  q1\t<cold>\t<hot1>\t<hot2>\t<best>
    //   TPCDS: query1\t<cold>\t<hot1>\t<hot2>\t<best>
    for (const rawLine of logLines) {
      const line = rawLine.replace(/\r/g, '').trim()
      if (!line) continue

      const parts = line.split('\t')
      if (parts.length < 5) continue

      const queryId = parts[0].toLowerCase()
      if (!/^(flat_)?(?:q(?:uery)?)\d+(?:[._]\d+)?$/.test(queryId)) continue

      const coldRun = parseInt(parts[1], 10)
      const hotRun1 = parseInt(parts[2], 10)
      const hotRun2 = parseInt(parts[3], 10)
      const bestHotRun = parseInt(parts[4], 10)

      if (isNaN(coldRun) || isNaN(hotRun1) || isNaN(hotRun2) || isNaN(bestHotRun)) continue
      if (coldRun <= 0 || coldRun > 99999999) continue

      results.push({ queryId, coldRun, hotRun1, hotRun2, bestHotRun })
    }

    return results
  }

  private buildQueryResults(testType: string, queryData: { queryId: string; coldRun: number; hotRun1: number; hotRun2: number; bestHotRun: number }[]): EnhancedQueryResult[] {
    const queryIds = this.getQueryIds(testType)

    return queryIds.map((queryId) => {
      const data = queryData.find(q => q.queryId.toLowerCase() === queryId.toLowerCase())
      const detail: QueryRunDetail = data
        ? { coldRun: data.coldRun, hotRun1: data.hotRun1, hotRun2: data.hotRun2, bestHotRun: data.bestHotRun }
        : { coldRun: 0, hotRun1: 0, hotRun2: 0, bestHotRun: 0 }

      const durationMs = detail.bestHotRun || detail.coldRun
      return {
        queryId,
        sql: '',
        durationMs,
        status: durationMs > 0 ? 'success' as const : 'error' as const,
        error: durationMs <= 0 ? 'No data' : undefined,
        runDetails: detail
      }
    })
  }

  private getQueryIds(testType: string): string[] {
    switch (testType) {
      case 'ssb':
        return ['q1.1', 'q1.2', 'q1.3', 'q2.1', 'q2.2', 'q2.3', 'q3.1', 'q3.2', 'q3.3', 'q3.4', 'q4.1', 'q4.2', 'q4.3']
      case 'tpch':
        return Array.from({ length: 22 }, (_, i) => `q${i + 1}`)
      case 'tpcds':
        return Array.from({ length: 99 }, (_, i) => `query${i + 1}`)
      default:
        return []
    }
  }

  private calculateStdDev(values: number[], mean: number): number {
    if (values.length === 0) return 0
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length
    return Math.sqrt(avgSquaredDiff)
  }

  private calculatePerformanceScore(avgCold: number, avgHot: number, hotStdDev: number, queryCount: number): number {
    if (avgCold === 0) return 0
    const cacheEfficiency = 1 - (avgHot / avgCold)
    const consistencyScore = hotStdDev > 0 ? Math.max(0, 1 - (hotStdDev / (avgHot || 1))) : 1
    const scaleFactor = Math.min(queryCount / 20, 1)
    return (cacheEfficiency * 0.5 + consistencyScore * 0.3 + scaleFactor * 0.2) * 100
  }
}
