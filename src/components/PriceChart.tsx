import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import {
  createChart,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type AreaData,
  type HistogramData,
  type LineData,
  type Time,
} from 'lightweight-charts'
import type { Candle, Quote } from '../lib/types'
import { SYMBOLS } from '../lib/marketFeed'
import {
  generateHistoricalCandles,
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
} from '../lib/indicators'

export type Timeframe = '1s' | '5s' | '15s' | '1m' | '5m'
export type ChartType = 'candles' | 'line'

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1s': 1,
  '5s': 5,
  '15s': 15,
  '1m': 60,
  '5m': 300,
}

interface PriceChartProps {
  symbol: string
  candle: Candle | undefined
  quote?: Quote
}

export function PriceChart({ symbol, candle }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  // Series references
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbMidRef = useRef<ISeriesApi<'Line'> | null>(null)

  // Internal history buffer
  const historyRef = useRef<Candle[]>([])
  const lastBucketTimeRef = useRef<number>(0)

  // User UI controls
  const [timeframe, setTimeframe] = useState<Timeframe>('1s')
  const [chartType, setChartType] = useState<ChartType>('candles')
  const [showVolume, setShowVolume] = useState(true)
  const [showSMA, setShowSMA] = useState(true)
  const [showEMA, setShowEMA] = useState(false)
  const [showBB, setShowBB] = useState(false)

  const cfg = useMemo(() => SYMBOLS.find((s) => s.symbol === symbol), [symbol])

  // Initialize Lightweight Charts once
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
      timeScale: {
        borderColor: '#1f2840',
        timeVisible: true,
        secondsVisible: true,
      },
      crosshair: { mode: 0 },
      autoSize: true,
    })

    // 1. Candlestick series
    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: '#16c784',
      downColor: '#ea3943',
      wickUpColor: '#16c784',
      wickDownColor: '#ea3943',
      borderVisible: false,
    })

    // 2. Area series (for line chart toggle)
    areaSeriesRef.current = chart.addAreaSeries({
      lineColor: '#3878ff',
      topColor: 'rgba(56, 120, 255, 0.28)',
      bottomColor: 'rgba(56, 120, 255, 0.00)',
      lineWidth: 2,
      visible: false,
    })

    // 3. Volume overlay
    const vol = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    vol.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    })
    volumeSeriesRef.current = vol

    // 4. SMA 20 (Cyan)
    smaSeriesRef.current = chart.addLineSeries({
      color: '#00d2d3',
      lineWidth: 2,
      title: 'SMA 20',
    })

    // 5. EMA 50 (Orange)
    emaSeriesRef.current = chart.addLineSeries({
      color: '#ff9f43',
      lineWidth: 2,
      title: 'EMA 50',
      visible: false,
    })

    // 6. Bollinger Bands (Lilac/dashed)
    bbUpperRef.current = chart.addLineSeries({
      color: 'rgba(165, 94, 234, 0.7)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      visible: false,
    })
    bbMidRef.current = chart.addLineSeries({
      color: 'rgba(165, 94, 234, 0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      visible: false,
    })
    bbLowerRef.current = chart.addLineSeries({
      color: 'rgba(165, 94, 234, 0.7)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      visible: false,
    })

    chartRef.current = chart

    return () => {
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      areaSeriesRef.current = null
      volumeSeriesRef.current = null
      smaSeriesRef.current = null
      emaSeriesRef.current = null
      bbUpperRef.current = null
      bbLowerRef.current = null
      bbMidRef.current = null
    }
  }, [])

  // Sync series visibility when indicator states change
  useEffect(() => {
    candleSeriesRef.current?.applyOptions({ visible: chartType === 'candles' })
    areaSeriesRef.current?.applyOptions({ visible: chartType === 'line' })
  }, [chartType])

  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: showVolume })
  }, [showVolume])

  useEffect(() => {
    smaSeriesRef.current?.applyOptions({ visible: showSMA })
  }, [showSMA])

  useEffect(() => {
    emaSeriesRef.current?.applyOptions({ visible: showEMA })
  }, [showEMA])

  useEffect(() => {
    bbUpperRef.current?.applyOptions({ visible: showBB })
    bbMidRef.current?.applyOptions({ visible: showBB })
    bbLowerRef.current?.applyOptions({ visible: showBB })
  }, [showBB])

  // Re-seed chart with historical candles when symbol or timeframe changes
  const reloadData = useCallback(() => {
    if (!cfg) return
    const tfSec = TIMEFRAME_SECONDS[timeframe]
    const nowSec = Math.floor(Date.now() / 1000)

    const initialPrice = cfg.initialPrice
    const candles = generateHistoricalCandles(
      initialPrice,
      cfg.volatility,
      cfg.drift,
      140,
      tfSec,
      nowSec,
    )

    historyRef.current = candles
    if (candles.length > 0) {
      lastBucketTimeRef.current = candles[candles.length - 1].time
    }

    // Set Candlestick / Area series data
    const candleData: CandlestickData[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
    candleSeriesRef.current?.setData(candleData)

    const areaData: AreaData[] = candles.map((c) => ({
      time: c.time as Time,
      value: c.close,
    }))
    areaSeriesRef.current?.setData(areaData)

    // Set Volume data
    const volData: HistogramData[] = candles.map((c) => ({
      time: c.time as Time,
      value: Math.max(10, Math.round(Math.abs(c.close - c.open) * 500 + 40)),
      color: c.close >= c.open ? 'rgba(22, 199, 132, 0.4)' : 'rgba(234, 57, 67, 0.4)',
    }))
    volumeSeriesRef.current?.setData(volData)

    // Set SMA data
    const sma = calculateSMA(candles, 20)
    const smaData: LineData[] = sma.map((p) => ({ time: p.time as Time, value: p.value }))
    smaSeriesRef.current?.setData(smaData)

    // Set EMA data
    const ema = calculateEMA(candles, 50)
    const emaData: LineData[] = ema.map((p) => ({ time: p.time as Time, value: p.value }))
    emaSeriesRef.current?.setData(emaData)

    // Set Bollinger Bands data
    const bb = calculateBollingerBands(candles, 20, 2)
    bbUpperRef.current?.setData(bb.map((p) => ({ time: p.time as Time, value: p.upper })))
    bbMidRef.current?.setData(bb.map((p) => ({ time: p.time as Time, value: p.middle })))
    bbLowerRef.current?.setData(bb.map((p) => ({ time: p.time as Time, value: p.lower })))

    // Fit chart bounds nicely
    chartRef.current?.timeScale().fitContent()
  }, [cfg, timeframe])

  // Trigger reload on symbol or timeframe change
  useEffect(() => {
    reloadData()
  }, [reloadData])

  // Stream live candle updates
  useEffect(() => {
    if (!candle) return
    const tfSec = TIMEFRAME_SECONDS[timeframe]
    const bucketTime = Math.floor(candle.time / tfSec) * tfSec
    const history = historyRef.current
    if (history.length === 0) return

    const lastCandle = history[history.length - 1]

    if (bucketTime === lastCandle.time) {
      // Update forming candle
      lastCandle.high = Math.max(lastCandle.high, candle.high)
      lastCandle.low = Math.min(lastCandle.low, candle.low)
      lastCandle.close = candle.close

      const cPoint: CandlestickData = {
        time: lastCandle.time as Time,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close,
      }
      candleSeriesRef.current?.update(cPoint)
      areaSeriesRef.current?.update({ time: lastCandle.time as Time, value: lastCandle.close })
    } else if (bucketTime > lastCandle.time) {
      // New candle bar
      const newCandle: Candle = {
        time: bucketTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }
      history.push(newCandle)
      if (history.length > 300) history.shift()

      const cPoint: CandlestickData = {
        time: bucketTime as Time,
        open: newCandle.open,
        high: newCandle.high,
        low: newCandle.low,
        close: newCandle.close,
      }
      candleSeriesRef.current?.update(cPoint)
      areaSeriesRef.current?.update({ time: bucketTime as Time, value: newCandle.close })

      // Update volume
      const volPoint: HistogramData = {
        time: bucketTime as Time,
        value: Math.max(10, Math.round(Math.abs(newCandle.close - newCandle.open) * 500 + 40)),
        color: newCandle.close >= newCandle.open ? 'rgba(22, 199, 132, 0.4)' : 'rgba(234, 57, 67, 0.4)',
      }
      volumeSeriesRef.current?.update(volPoint)

      // Update indicators with new bar
      if (showSMA) {
        const sma = calculateSMA(history, 20)
        if (sma.length > 0) {
          const pt = sma[sma.length - 1]
          smaSeriesRef.current?.update({ time: pt.time as Time, value: pt.value })
        }
      }
      if (showEMA) {
        const ema = calculateEMA(history, 50)
        if (ema.length > 0) {
          const pt = ema[ema.length - 1]
          emaSeriesRef.current?.update({ time: pt.time as Time, value: pt.value })
        }
      }
      if (showBB) {
        const bb = calculateBollingerBands(history, 20, 2)
        if (bb.length > 0) {
          const pt = bb[bb.length - 1]
          bbUpperRef.current?.update({ time: pt.time as Time, value: pt.upper })
          bbMidRef.current?.update({ time: pt.time as Time, value: pt.middle })
          bbLowerRef.current?.update({ time: pt.time as Time, value: pt.lower })
        }
      }
    }
  }, [candle, timeframe, showSMA, showEMA, showBB])

  return (
    <div className="price-chart-wrapper">
      <div className="chart-toolbar">
        <div className="chart-tf-group">
          {(['1s', '5s', '15s', '1m', '5m'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              type="button"
              className={`chart-btn ${timeframe === tf ? 'active' : ''}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="chart-divider" />

        <div className="chart-style-group">
          <button
            type="button"
            className={`chart-btn ${chartType === 'candles' ? 'active' : ''}`}
            onClick={() => setChartType('candles')}
            title="Candlestick chart"
          >
            Candles
          </button>
          <button
            type="button"
            className={`chart-btn ${chartType === 'line' ? 'active' : ''}`}
            onClick={() => setChartType('line')}
            title="Area/Line chart"
          >
            Line
          </button>
        </div>

        <div className="chart-divider" />

        <div className="chart-indicators-group">
          <button
            type="button"
            className={`chart-btn indicator ${showSMA ? 'active-sma' : ''}`}
            onClick={() => setShowSMA(!showSMA)}
            title="Simple Moving Average (20)"
          >
            SMA 20
          </button>
          <button
            type="button"
            className={`chart-btn indicator ${showEMA ? 'active-ema' : ''}`}
            onClick={() => setShowEMA(!showEMA)}
            title="Exponential Moving Average (50)"
          >
            EMA 50
          </button>
          <button
            type="button"
            className={`chart-btn indicator ${showBB ? 'active-bb' : ''}`}
            onClick={() => setShowBB(!showBB)}
            title="Bollinger Bands (20, 2)"
          >
            BB
          </button>
          <button
            type="button"
            className={`chart-btn indicator ${showVolume ? 'active' : ''}`}
            onClick={() => setShowVolume(!showVolume)}
            title="Volume Histogram"
          >
            Vol
          </button>
        </div>
      </div>

      <div className="chart-canvas-container" ref={containerRef} />
    </div>
  )
}
