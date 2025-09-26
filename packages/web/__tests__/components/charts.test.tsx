import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TimeSeriesChart, type TimeSeriesDataPoint } from '@/components/charts/TimeSeriesChart'
import { EngagementChart } from '@/components/charts/EngagementChart'
import { HeatMap } from '@/components/charts/HeatMap'
import { GrowthChart } from '@/components/charts/GrowthChart'
import { MobileChart } from '@/components/charts/MobileChart'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock Recharts components to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children, data }: any) => (
    <div data-testid="line-chart" data-points={data?.length}>
      {children}
    </div>
  ),
  AreaChart: ({ children, data }: any) => (
    <div data-testid="area-chart" data-points={data?.length}>
      {children}
    </div>
  ),
  BarChart: ({ children, data }: any) => (
    <div data-testid="bar-chart" data-points={data?.length}>
      {children}
    </div>
  ),
  Line: ({ dataKey, stroke }: any) => <div data-testid={`line-${dataKey}`} data-stroke={stroke} />,
  Area: ({ dataKey, fill }: any) => <div data-testid={`area-${dataKey}`} data-fill={fill} />,
  Bar: ({ dataKey, fill }: any) => <div data-testid={`bar-${dataKey}`} data-fill={fill} />,
  XAxis: ({ dataKey }: any) => <div data-testid="x-axis" data-key={dataKey} />,
  YAxis: ({ domain }: any) => <div data-testid="y-axis" data-domain={domain} />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: ({ content }: any) => <div data-testid="tooltip">{content}</div>,
  Legend: () => <div data-testid="legend" />,
  Brush: ({ height }: any) => <div data-testid="brush" data-height={height} />,
  ReferenceLine: ({ y, label }: any) => (
    <div data-testid="reference-line" data-y={y} data-label={label} />
  ),
  Cell: ({ fill }: any) => <div data-testid="cell" data-fill={fill} />,
}))

// Test wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe.skip('Chart Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('TimeSeriesChart', () => {
    const mockData: TimeSeriesDataPoint[] = [
      { date: '2024-01-01', value: 100, score: 150, comments: 25 },
      { date: '2024-01-02', value: 120, score: 180, comments: 30 },
      { date: '2024-01-03', value: 90, score: 140, comments: 20 },
      { date: '2024-01-04', value: 150, score: 200, comments: 40 },
      { date: '2024-01-05', value: 130, score: 170, comments: 35 },
    ]

    it('should render line chart with data', () => {
      render(
        <TimeSeriesChart
          data={mockData}
          lines={[{ dataKey: 'value', name: 'Posts', color: '#8884d8' }]}
        />
      )

      const chart = screen.getByTestId('line-chart')
      expect(chart).toHaveAttribute('data-points', '5')
      expect(screen.getByTestId('line-value')).toBeInTheDocument()
    })

    it('should render area chart when chartType is area', () => {
      render(
        <TimeSeriesChart
          data={mockData}
          chartType="area"
          lines={[{ dataKey: 'value', name: 'Posts', color: '#8884d8' }]}
        />
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('area-value')).toBeInTheDocument()
    })

    it('should render multiple lines', () => {
      render(
        <TimeSeriesChart
          data={mockData}
          lines={[
            { dataKey: 'value', name: 'Posts', color: '#8884d8' },
            { dataKey: 'score', name: 'Score', color: '#82ca9d' },
            { dataKey: 'comments', name: 'Comments', color: '#ffc658' },
          ]}
        />
      )

      expect(screen.getByTestId('line-value')).toBeInTheDocument()
      expect(screen.getByTestId('line-score')).toBeInTheDocument()
      expect(screen.getByTestId('line-comments')).toBeInTheDocument()
    })

    it('should show brush when enabled', () => {
      render(<TimeSeriesChart data={mockData} showBrush={true} brushHeight={40} />)

      const brush = screen.getByTestId('brush')
      expect(brush).toBeInTheDocument()
      expect(brush).toHaveAttribute('data-height', '40')
    })

    it('should show grid when enabled', () => {
      render(<TimeSeriesChart data={mockData} showGrid={true} />)

      expect(screen.getByTestId('grid')).toBeInTheDocument()
    })

    it('should show legend when enabled', () => {
      render(<TimeSeriesChart data={mockData} showLegend={true} />)

      expect(screen.getByTestId('legend')).toBeInTheDocument()
    })

    it('should show tooltip when enabled', () => {
      render(<TimeSeriesChart data={mockData} showTooltip={true} />)

      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    })

    it('should render reference lines', () => {
      render(
        <TimeSeriesChart
          data={mockData}
          referenceLines={[{ y: 100, label: 'Average', color: '#ff0000' }]}
        />
      )

      const refLine = screen.getByTestId('reference-line')
      expect(refLine).toHaveAttribute('data-y', '100')
      expect(refLine).toHaveAttribute('data-label', 'Average')
    })

    it('should handle empty data gracefully', () => {
      render(
        <TimeSeriesChart
          data={[]}
          lines={[{ dataKey: 'value', name: 'Posts', color: '#8884d8' }]}
        />
      )

      const chart = screen.getByTestId('line-chart')
      expect(chart).toHaveAttribute('data-points', '0')
    })

    it('should apply custom height', () => {
      const { container } = render(<TimeSeriesChart data={mockData} height={500} />)

      const wrapper = container.querySelector('[style*="height"]')
      expect(wrapper).toHaveStyle({ height: '500px' })
    })
  })

  describe('EngagementChart', () => {
    const mockEngagementData = [
      { date: '2024-01-01', score: 1500, comments: 250, posts: 50 },
      { date: '2024-01-02', score: 1800, comments: 300, posts: 60 },
      { date: '2024-01-03', score: 1600, comments: 280, posts: 55 },
    ]

    it('should render engagement metrics', () => {
      render(<EngagementChart data={mockEngagementData} />, { wrapper: createWrapper() })

      // Should render as area chart by default
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('area-score')).toBeInTheDocument()
      expect(screen.getByTestId('area-comments')).toBeInTheDocument()
    })

    it('should display title', () => {
      render(<EngagementChart data={mockEngagementData} title="Engagement Metrics" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText('Engagement Metrics')).toBeInTheDocument()
    })

    it('should handle metric selection', () => {
      render(<EngagementChart data={mockEngagementData} showMetricSelector={true} />, {
        wrapper: createWrapper(),
      })

      // Look for metric selector buttons
      const scoreButton = screen.getByRole('button', { name: /score/i })
      const commentsButton = screen.getByRole('button', { name: /comments/i })

      expect(scoreButton).toBeInTheDocument()
      expect(commentsButton).toBeInTheDocument()
    })

    it('should show comparison view', () => {
      render(<EngagementChart data={mockEngagementData} showComparison={true} />, {
        wrapper: createWrapper(),
      })

      // Should show multiple metrics for comparison
      expect(screen.getByTestId('area-score')).toBeInTheDocument()
      expect(screen.getByTestId('area-comments')).toBeInTheDocument()
    })
  })

  describe('HeatMap', () => {
    const mockHeatmapData = {
      data: [
        { hour: 0, day: 'Mon', value: 10 },
        { hour: 1, day: 'Mon', value: 15 },
        { hour: 0, day: 'Tue', value: 20 },
        { hour: 1, day: 'Tue', value: 25 },
      ],
      maxValue: 25,
    }

    it('should render heatmap cells', () => {
      render(<HeatMap data={mockHeatmapData.data} xKey="hour" yKey="day" valueKey="value" />)

      const cells = screen.getAllByTestId('cell')
      expect(cells.length).toBeGreaterThan(0)
    })

    it('should display title', () => {
      render(
        <HeatMap
          data={mockHeatmapData.data}
          xKey="hour"
          yKey="day"
          valueKey="value"
          title="Activity Heatmap"
        />
      )

      expect(screen.getByText('Activity Heatmap')).toBeInTheDocument()
    })

    it('should handle empty data', () => {
      render(<HeatMap data={[]} xKey="hour" yKey="day" valueKey="value" />)

      expect(screen.getByText(/no data/i)).toBeInTheDocument()
    })

    it('should show tooltip on hover', () => {
      render(
        <HeatMap
          data={mockHeatmapData.data}
          xKey="hour"
          yKey="day"
          valueKey="value"
          showTooltip={true}
        />
      )

      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    })

    it('should apply color scale', () => {
      render(
        <HeatMap
          data={mockHeatmapData.data}
          xKey="hour"
          yKey="day"
          valueKey="value"
          colorScale={['#f0f0f0', '#ff0000']}
        />
      )

      const cells = screen.getAllByTestId('cell')
      // Cells should have fill colors from the scale
      cells.forEach((cell) => {
        expect(cell).toHaveAttribute('data-fill')
      })
    })
  })

  describe('GrowthChart', () => {
    const mockGrowthData = [
      { date: '2024-01-01', value: 100, growth: 0 },
      { date: '2024-01-02', value: 110, growth: 10 },
      { date: '2024-01-03', value: 125, growth: 13.6 },
      { date: '2024-01-04', value: 120, growth: -4 },
    ]

    it('should render growth chart', () => {
      render(<GrowthChart data={mockGrowthData} />)

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
      expect(screen.getByTestId('bar-growth')).toBeInTheDocument()
    })

    it('should show positive and negative growth', () => {
      render(<GrowthChart data={mockGrowthData} positiveColor="#00ff00" negativeColor="#ff0000" />)

      const bars = screen.getAllByTestId('bar-growth')
      expect(bars.length).toBeGreaterThan(0)
    })

    it('should display period selector', () => {
      render(<GrowthChart data={mockGrowthData} showPeriodSelector={true} />)

      const dayButton = screen.getByRole('button', { name: /day/i })
      const weekButton = screen.getByRole('button', { name: /week/i })
      const monthButton = screen.getByRole('button', { name: /month/i })

      expect(dayButton).toBeInTheDocument()
      expect(weekButton).toBeInTheDocument()
      expect(monthButton).toBeInTheDocument()
    })

    it('should show growth percentage labels', () => {
      render(<GrowthChart data={mockGrowthData} showLabels={true} />)

      // Growth percentages should be formatted
      expect(screen.getByText(/10%/)).toBeInTheDocument()
      expect(screen.getByText(/13.6%/)).toBeInTheDocument()
    })
  })

  describe('MobileChart', () => {
    const mockMobileData = [
      { label: 'Jan', value: 100 },
      { label: 'Feb', value: 150 },
      { label: 'Mar', value: 120 },
    ]

    it('should render in mobile-optimized format', () => {
      render(<MobileChart data={mockMobileData} type="bar" />)

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    it('should handle swipe gestures', () => {
      const onSwipe = vi.fn()

      render(<MobileChart data={mockMobileData} type="line" onSwipe={onSwipe} />)

      const chart = screen.getByTestId('line-chart')

      // Simulate swipe
      fireEvent.touchStart(chart, {
        touches: [{ clientX: 100, clientY: 100 }],
      })
      fireEvent.touchEnd(chart, {
        changedTouches: [{ clientX: 200, clientY: 100 }],
      })

      expect(onSwipe).toHaveBeenCalled()
    })

    it('should show simplified controls', () => {
      render(<MobileChart data={mockMobileData} type="line" showControls={true} />)

      // Mobile charts should have simplified controls
      const zoomInButton = screen.getByRole('button', { name: /zoom in/i })
      const zoomOutButton = screen.getByRole('button', { name: /zoom out/i })

      expect(zoomInButton).toBeInTheDocument()
      expect(zoomOutButton).toBeInTheDocument()
    })

    it('should adapt height for mobile viewport', () => {
      const { container } = render(
        <MobileChart data={mockMobileData} type="area" mobileHeight={250} />
      )

      const wrapper = container.querySelector('[style*="height"]')
      expect(wrapper).toHaveStyle({ height: '250px' })
    })

    it('should show loading state', () => {
      render(<MobileChart data={[]} type="line" loading={true} />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('should handle empty data with message', () => {
      render(<MobileChart data={[]} type="bar" emptyMessage="No data to display" />)

      expect(screen.getByText('No data to display')).toBeInTheDocument()
    })
  })
})
