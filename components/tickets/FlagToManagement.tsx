'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Flag, MessageSquare, Send, Clock, CheckCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc/Provider';
import { useUser } from '@/contexts/UserContext';
import { format } from 'date-fns';

interface FlagToManagementProps {
  complaintId: string;
  complaintReference: string;
  onTicketCreated?: () => void;
}

export function FlagToManagement({ complaintId, complaintReference, onTicketCreated }: FlagToManagementProps) {
  const { currentUser } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');

  const createTicket = trpc.tickets.create.useMutation({
    onSuccess: () => {
      setIsOpen(false);
      setSubject('');
      setDescription('');
      setPriority('medium');
      onTicketCreated?.();
      alert('Ticket raised successfully! Management will be notified.');
    },
    onError: (error) => {
      alert(`Failed to create ticket: ${error.message}`);
    },
  });

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="w-full border-orange-200 text-orange-700 hover:bg-orange-50"
      >
        <Flag className="h-4 w-4 mr-2" />
        Flag to Management
      </Button>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    createTicket.mutate({
      complaintId,
      subject: subject.trim(),
      description: description.trim(),
      priority,
    });
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'low': return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'medium': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'urgent': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-700">
          <Flag className="h-5 w-5" />
          Flag to Management
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Request assistance or escalate an issue for {complaintReference}
        </p>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
              <SelectTrigger id="priority">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">
                  <Badge variant="outline" className={getPriorityColor('low')}>Low - General inquiry</Badge>
                </SelectItem>
                <SelectItem value="medium">
                  <Badge variant="outline" className={getPriorityColor('medium')}>Medium - Needs review</Badge>
                </SelectItem>
                <SelectItem value="high">
                  <Badge variant="outline" className={getPriorityColor('high')}>High - Urgent attention</Badge>
                </SelectItem>
                <SelectItem value="urgent">
                  <Badge variant="outline" className={getPriorityColor('urgent')}>Urgent - Critical issue</Badge>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              placeholder="Brief summary of the issue"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              required
            />
            <p className="text-xs text-muted-foreground">{subject.length}/200 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Explain the issue, what help you need, and any relevant context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              required
            />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              <strong>Note:</strong> Management will be notified immediately. You'll receive a response in your tickets dashboard.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsOpen(false)}
            disabled={createTicket.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createTicket.isPending || !subject.trim() || !description.trim()}>
            {createTicket.isPending ? (
              <>Submitting...</>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Raise Ticket
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

// Component to display existing tickets for a complaint
export function ComplaintTickets({ complaintId }: { complaintId: string }) {
  const { data: tickets, isLoading } = trpc.tickets.getByComplaint.useQuery(complaintId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading tickets...</p>;
  }

  if (!tickets || tickets.length === 0) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'in_progress': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'resolved': return 'bg-green-100 text-green-700 border-green-300';
      case 'closed': return 'bg-gray-100 text-gray-700 border-gray-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-700';
      case 'medium': return 'bg-blue-100 text-blue-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'urgent': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Card className="border-orange-200">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Flag className="h-4 w-4 text-orange-600" />
          Management Tickets ({tickets.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tickets.map((ticket: any) => (
          <div key={ticket.id} className="border rounded-lg p-3 hover:bg-accent/30 transition-colors">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{ticket.subject}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {ticket.description}
                </p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Badge variant="outline" className={`text-xs ${getStatusColor(ticket.status)}`}>
                  {ticket.status.replace('_', ' ')}
                </Badge>
                <Badge variant="outline" className={`text-xs ${getPriorityColor(ticket.priority)}`}>
                  {ticket.priority}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(ticket.created_at), 'PP')}
              </span>
              {ticket.assigned_to_name && (
                <span>Assigned: {ticket.assigned_to_name}</span>
              )}
              {ticket.resolved_at && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Resolved {format(new Date(ticket.resolved_at), 'PP')}
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

