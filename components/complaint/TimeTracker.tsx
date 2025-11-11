'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, FileText, Mail, Search, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface TimeEntry {
  activity: string;
  duration: number; // minutes
  rate: number; // per hour
  date: string;
  icon?: React.ReactNode;
}

interface TimeTrackerProps {
  complaintId: string;
  entries: TimeEntry[];
  chargeOutRate?: number;
}

export function TimeTracker({ complaintId, entries, chargeOutRate = 250 }: TimeTrackerProps) {
  // Auto-track activities with standard time allocations
  const getActivityIcon = (activity: string) => {
    if (activity.includes('Analysis')) return <Search className="h-4 w-4" />;
    if (activity.includes('Letter')) return <FileText className="h-4 w-4" />;
    if (activity.includes('Response')) return <Mail className="h-4 w-4" />;
    if (activity.includes('Review')) return <AlertCircle className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  const calculateValue = (minutes: number, rate: number) => {
    return (minutes / 60) * rate;
  };

  const totalMinutes = entries.reduce((sum, entry) => sum + entry.duration, 0);
  const totalValue = entries.reduce((sum, entry) => 
    sum + calculateValue(entry.duration, entry.rate || chargeOutRate), 0
  );

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Time & Value</span>
          <Badge variant="outline" className="bg-green-50 text-green-700">
            £{totalValue.toFixed(2)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground">Total Time</p>
            <p className="text-lg font-semibold">{formatDuration(totalMinutes)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Charge Rate</p>
            <p className="text-lg font-semibold">£{chargeOutRate}/hr</p>
          </div>
        </div>

        {/* Time Entries */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Activity Log</h4>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No time entries yet
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {entries.map((entry, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-2 rounded border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="mt-0.5 text-muted-foreground">
                    {getActivityIcon(entry.activity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.activity}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(entry.date), 'PP p')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatDuration(entry.duration)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      £{calculateValue(entry.duration, entry.rate || chargeOutRate).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invoicing Note */}
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Note:</strong> Time is automatically tracked for analysis, letter generation, 
            and response reviews. All activities are billable at your practice rate.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

