'use client';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, Clock, Send, ArrowRight } from 'lucide-react';
import { trpc } from '@/lib/trpc/Provider';

interface StatusManagerProps {
  complaintId: string;
  currentStatus: string;
  onStatusChange?: () => void;
}

export function StatusManager({ complaintId, currentStatus, onStatusChange }: StatusManagerProps) {
  const utils = trpc.useUtils();
  
  const updateStatus = trpc.complaints.updateStatus.useMutation({
    onSuccess: () => {
      utils.complaints.getById.invalidate(complaintId);
      utils.complaints.list.invalidate();
      onStatusChange?.();
    },
  });

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'assessment':
        return {
          label: 'In Assessment',
          color: 'bg-blue-100 text-blue-700',
          icon: <Clock className="h-4 w-4" />,
          nextAction: 'Mark as Active',
          nextStatus: 'active',
          description: 'Analyzing complaint and generating initial letter',
        };
      case 'active':
        return {
          label: 'Active',
          color: 'bg-yellow-100 text-yellow-700',
          icon: <Send className="h-4 w-4" />,
          nextAction: 'Escalate to Tier 2',
          nextStatus: 'escalated',
          description: 'Letter sent to HMRC, awaiting response',
        };
      case 'escalated':
        return {
          label: 'Escalated',
          color: 'bg-orange-100 text-orange-700',
          icon: <AlertTriangle className="h-4 w-4" />,
          nextAction: 'Mark as Resolved',
          nextStatus: 'resolved',
          description: 'Escalated to Tier 2 or Adjudicator',
        };
      case 'resolved':
        return {
          label: 'Resolved',
          color: 'bg-green-100 text-green-700',
          icon: <CheckCircle className="h-4 w-4" />,
          nextAction: 'Close Complaint',
          nextStatus: 'closed',
          description: 'Complaint resolved successfully',
        };
      case 'closed':
        return {
          label: 'Closed',
          color: 'bg-gray-100 text-gray-700',
          icon: <CheckCircle className="h-4 w-4" />,
          nextAction: null,
          nextStatus: null,
          description: 'Complaint closed',
        };
      default:
        return {
          label: status,
          color: 'bg-gray-100 text-gray-700',
          icon: <Clock className="h-4 w-4" />,
          nextAction: null,
          nextStatus: null,
          description: '',
        };
    }
  };

  const statusInfo = getStatusInfo(currentStatus);

  const handleStatusChange = () => {
    if (statusInfo.nextStatus) {
      updateStatus.mutate({
        id: complaintId,
        status: statusInfo.nextStatus as any,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Status</span>
          <Badge className={statusInfo.color}>
            {statusInfo.icon}
            <span className="ml-2">{statusInfo.label}</span>
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {statusInfo.description}
        </p>

        {statusInfo.nextAction && (
          <Button
            onClick={handleStatusChange}
            disabled={updateStatus.isPending}
            className="w-full"
            variant={currentStatus === 'assessment' ? 'default' : 'outline'}
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            {updateStatus.isPending ? 'Updating...' : statusInfo.nextAction}
          </Button>
        )}

        {/* Status Timeline */}
        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-3">Complaint Lifecycle</h4>
          <div className="space-y-2">
            {['assessment', 'active', 'escalated', 'resolved', 'closed'].map((status, index) => {
              const info = getStatusInfo(status);
              const isCurrent = status === currentStatus;
              const isPast = ['assessment', 'active', 'escalated', 'resolved', 'closed'].indexOf(status) < 
                              ['assessment', 'active', 'escalated', 'resolved', 'closed'].indexOf(currentStatus);
              
              return (
                <div
                  key={status}
                  className={`flex items-center gap-2 text-sm ${
                    isCurrent ? 'font-medium' : isPast ? 'text-muted-foreground' : 'text-muted-foreground/50'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${
                    isCurrent ? 'bg-primary' : isPast ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                  {info.label}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

