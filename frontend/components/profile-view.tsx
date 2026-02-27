import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { User, Bell, FileText, Settings } from 'lucide-react'

export function ProfileView() {
  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Profile & Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile Card */}
      <Card className="p-6">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <User className="w-10 h-10 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold">John Doe</h2>
            <p className="text-muted-foreground">john.doe@greentrack.com</p>
            <div className="mt-4">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-muted rounded-full text-sm">
                <Settings className="w-4 h-4" />
                Logistics Manager
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* User Information */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">User Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input id="firstName" defaultValue="John" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input id="lastName" defaultValue="Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue="john.doe@greentrack.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" defaultValue="+49 123 456 7890" />
          </div>
        </div>
        <Button className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90">Save Changes</Button>
      </Card>

      {/* Notification Preferences */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notification Preferences
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Route Optimization Alerts</Label>
              <p className="text-sm text-muted-foreground">Get notified when route optimizations are available</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Sustainability Recommendations</Label>
              <p className="text-sm text-muted-foreground">Receive eco-friendly alternative suggestions</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Vehicle Maintenance Reminders</Label>
              <p className="text-sm text-muted-foreground">Get alerts for scheduled vehicle maintenance</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Daily Performance Summary</Label>
              <p className="text-sm text-muted-foreground">Receive daily reports on fleet performance</p>
            </div>
            <Switch />
          </div>
        </div>
      </Card>

      {/* Report Generation */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Report Generation
        </h2>
        <p className="text-muted-foreground mb-4">Generate and download comprehensive reports on fleet performance and sustainability metrics</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" className="flex-1">
            Weekly Performance Report
          </Button>
          <Button variant="outline" className="flex-1">
            Monthly Emissions Report
          </Button>
          <Button variant="outline" className="flex-1">
            Annual Sustainability Report
          </Button>
        </div>
      </Card>

      {/* Access Control */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Access & Roles</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="font-medium">Role</span>
            <span className="text-muted-foreground">Logistics Manager</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="font-medium">Department</span>
            <span className="text-muted-foreground">Operations</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="font-medium">Access Level</span>
            <span className="text-muted-foreground">Full Access</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
