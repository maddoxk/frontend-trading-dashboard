import { useEffect, useRef } from 'react'
import {
  createChart,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from 'lightweight-charts'
import type { Candle } from '../lib/types'

interface PriceChartProps {
  symbol: string
  candle: Candle | undefined
}

/**
 * Live candlestick chart powered by lightweight-charts. New 1-second candles are
 * pushed via the series `update()` API, which is the efficient streaming path.
 */
export function PriceChart({ symbol, candle }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lastSymbol = useRef<string>('')

  // create chart once
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8a97ad',
        fontFamily: "'SF Mono', ui-monospace, monospace",
      },
      grid: {
        vertLines: { color: '#19203250' },
        horzLines: { color: '#19203250' },
      },
      rightPriceScale: { borderColor: '#1f2840' },
      timeScale: { borderColor: '#1f2840', timeVisible: true, secondsVisible: true },
      crosshair: { mode: 0 },
      autoSize: true,
    })
    const series = chart.addCandlestickSeries({
      upColor: '#16c784',
      downColor: '#ea3943',
      wickUpColor: '#16c784',
      wickDownColor: '#ea3943',
      borderVisible: false,
    })
    chartRef.current = chart
    seriesRef.current = series

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // reset data when the symbol changes
  useEffect(() => {
    if (lastSymbol.current !== symbol) {
      seriesRef.current?.setData([])
      lastSymbol.current = symbol
    }
  }, [symbol])

  // stream candle updates
  useEffect(() => {
    if (!candle || !seriesRef.current) return
    const point: CandlestickData = {
      time: candle.time as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }
    seriesRef.current.update(point)
  }, [candle])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
