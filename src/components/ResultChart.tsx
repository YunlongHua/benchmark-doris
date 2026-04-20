import { useEffect, useRef } from 'react'
import { Card } from 'antd'
import * as echarts from 'echarts'
import { useTestStore } from '../stores/testStore'

export default function ResultChart() {
  const { result } = useTestStore()
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts>()

  useEffect(() => {
    if (!chartRef.current) return
    chartInstance.current = echarts.init(chartRef.current)
    return () => { chartInstance.current?.dispose() }
  }, [])

  useEffect(() => {
    if (!chartInstance.current || !result) return
    const chart = chartInstance.current
    chart.setOption({
      title: { text: `${result.testType.toUpperCase()} Query Durations (ms)`, left: 'center' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: result.queries.map(q => q.queryId), axisLabel: { rotate: 45 } },
      yAxis: { type: 'value', name: 'ms' },
      series: [{
        type: 'bar',
        data: result.queries.map(q => ({ value: q.durationMs, itemStyle: { color: q.status === 'success' ? '#4477h' : '#ff4d4f' } }))
      }]
    })
  }, [result])

  if (!result) return null

  return (
    <Card title="Performance Chart">
      <div ref={chartRef} style={{ width: '100%', height: 300 }} />
    </Card>
  )
}