'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Info, Leaf, TrendingUp, Clock, Loader2, AlertCircle } from 'lucide-react'
import useSWR from 'swr'
import { fetchAlertsData, type AlertsData, type Alert } from '@/lib/api'

const ALERT_ICON_MAP: Record<string, typeof Leaf> = {
  optimization: TrendingUp,
  sustainability: Leaf,
  warning: AlertTriangle,
  info: Info,
}

const ALERT_COLOR_MAP: Record<string, string> = {
  optimization: 'text-chart-2',
  sustainability: 'text-primary',
  warning: 'text-accent',
  info: 'text-info',
}

const fallbackData: AlertsData = {
  alerts: [
    { id: 1, type: 'optimization', title: 'Route Optimization Available', message: 'Route 12 can be optimized to reduce emissions by 15% and save €45 in fuel costs.', time: '5 minutes ago', priority: 'medium' },
    { id: 2, type: 'sustainability', title: 'Eco-Friendly Alternative Found', message: 'Electric vehicle VH-003 is available and can handle Order ORD-1850, reducing CO₂ by 95 kg.', time: '12 minutes ago', priority: 'high' },
    { id: 3, type: 'warning', title: 'Vehicle Maintenance Due', message: 'Vehicle VH-004 requires scheduled maintenance within 48 hours. Plan route assignments accordingly.', time: '1 hour ago', priority: 'high' },
    { id: 4, type: 'info', title: 'Traffic Update', message: 'Heavy traffic reported on Route 45. Consider rerouting vehicles VH-005 to avoid delays.', time: '2 hours ago', priority: 'low' },
    { id: 5, type: 'optimization', title: 'Consolidation Opportunity', message: 'Orders ORD-1848 and ORD-1850 can be consolidated into a single delivery, saving 30% in transport costs.', time: '3 hours ago', priority: 'medium' },
    { id: 6, type: 'sustainability', title: 'Daily Emissions Target Met', message: "Great work! Today's fleet operations are 18% below the daily CO₂ emissions target.", time: '5 hours ago', priority: 'low' },
  ],
  summary: { highPriority: 2, sustainability: 2, optimizations: 2 },
}

export function AlertsView() {
  const { data, error, isLoading, mutate } = useSWR('alerts', fetchAlertsData, {
    fallbackData,
    revalidateOnFocus: true,
    refreshInterval: 15000,
    onError: () => {},
  })

  const alerts = data?.alerts ?? fallbackData.alerts
  const summary = data?.summary ?? fallbackData.summary

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Alerts & Recommendations</h1>
          <p className="text-muted-foreground mt-1">Stay informed with real-time notifications and optimization suggestions</p>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Syncing...
          </div>
        )}
        {error && !isLoading && (
          <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-2">
            <AlertCircle className="w-4 h-4 text-accent" />
            Retry
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.highPriority}</p>
              <p className="text-sm text-muted-foreground">High Priority</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">3</p>
              <p className="text-sm text-muted-foreground">Sustainability</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-bold">2</p>
              <p className="text-sm text-muted-foreground">Optimizations</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {alerts.map((alert) => {
          const Icon = alert.icon
          return (
            <Card key={alert.id} className="p-5 hover:border-primary/50 transition-colors">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className={`w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 ${alert.color}`}>
                  <Icon className="w-6 h-6" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{alert.title}</h3>
                      <Badge
                        variant={alert.priority === 'high' ? 'destructive' : 'secondary'}
                        className={
                          alert.priority === 'high'
                            ? 'bg-accent text-accent-foreground'
                            : alert.priority === 'medium'
                            ? 'bg-chart-2 text-primary-foreground'
                            : ''
                        }
                      >
                        {alert.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground flex-shrink-0">
                      <Clock className="w-4 h-4" />
                      {alert.time}
                    </div>
                  </div>
                  <p className="text-muted-foreground mb-4">{alert.message}</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                      Take Action
                    </Button>
                    <Button size="sm" variant="outline">
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
