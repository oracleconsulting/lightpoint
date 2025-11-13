'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc/Provider';
import { useUser } from '@/contexts/UserContext';
import { 
  Users, 
  FileText, 
  Flag, 
  Clock, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  Eye,
  MessageSquare 
} from 'lucide-react';
import { format } from 'date-fns';

export default function ManagementPage() {
  const { currentUser, isManager } = useUser();
  const [activeTab, setActiveTab] = useState<'overview' | 'tickets'>('overview');

  const { data: overview, isLoading: overviewLoading } = trpc.management.getOverview.useQuery(undefined, {
    enabled: isManager,
  });
  const { data: tickets, isLoading: ticketsLoading, refetch: refetchTickets } = trpc.tickets.list.useQuery(undefined, {
    enabled: isManager,
  });

  if (!isManager) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You don't have permission to access management features. Contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
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
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Management Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Team oversight, workload distribution, and ticket management
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'overview' ? 'default' : 'outline'}
          onClick={() => setActiveTab('overview')}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Overview
        </Button>
        <Button
          variant={activeTab === 'tickets' ? 'default' : 'outline'}
          onClick={() => setActiveTab('tickets')}
        >
          <Flag className="h-4 w-4 mr-2" />
          Tickets
          {tickets && tickets.filter((t: any) => t.status === 'open').length > 0 && (
            <Badge variant="outline" className="ml-2 bg-red-100 text-red-700">
              {tickets.filter((t: any) => t.status === 'open').length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold">{overview?.total_users || 0}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Complaints</p>
                    <p className="text-2xl font-bold">{overview?.total_complaints || 0}</p>
                  </div>
                  <FileText className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Open Tickets</p>
                    <p className="text-2xl font-bold">{overview?.open_tickets || 0}</p>
                  </div>
                  <Flag className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Hours</p>
                    <p className="text-2xl font-bold">{Math.round((overview?.total_minutes || 0) / 60)}</p>
                  </div>
                  <Clock className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Workload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Workload
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overviewLoading ? (
                <p className="text-center py-8 text-muted-foreground">Loading...</p>
              ) : overview && overview.users && overview.users.length > 0 ? (
                <div className="space-y-2">
                  {overview.users.map((user: any) => (
                    <div key={user.user_id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium">{user.full_name || user.email}</p>
                        <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <p className="font-semibold text-blue-600">{user.total_complaints || 0}</p>
                          <p className="text-xs text-muted-foreground">Complaints</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-green-600">{user.active_complaints || 0}</p>
                          <p className="text-xs text-muted-foreground">Active</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-orange-600">{user.open_tickets || 0}</p>
                          <p className="text-xs text-muted-foreground">Tickets</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-purple-600">{Math.round((user.total_minutes_logged || 0) / 60)}h</p>
                          <p className="text-xs text-muted-foreground">Logged</p>
                        </div>
                      </div>
                      {user.last_login && (
                        <div className="text-xs text-muted-foreground">
                          Last: {format(new Date(user.last_login), 'PP')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No team data available</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tickets Tab */}
      {activeTab === 'tickets' && (
        <TicketsManagement tickets={tickets} refetch={refetchTickets} isLoading={ticketsLoading} />
      )}
    </div>
  );
}

function TicketsManagement({ tickets, refetch, isLoading }: any) {
  const [filterStatus, setFilterStatus] = useState<string>('open');
  const [respondingToTicket, setRespondingToTicket] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  const updateTicket = trpc.tickets.update.useMutation({
    onSuccess: () => {
      refetch();
      setRespondingToTicket(null);
      setResponseText('');
    },
  });

  const addComment = trpc.tickets.addComment.useMutation({
    onSuccess: () => {
      refetch();
      setRespondingToTicket(null);
      setResponseText('');
    },
  });

  const filteredTickets = tickets?.filter((t: any) => 
    filterStatus === 'all' ? true : t.status === filterStatus
  ) || [];

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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Management Tickets ({filteredTickets.length})
          </CardTitle>
          <div className="flex gap-2">
            {['all', 'open', 'in_progress', 'resolved', 'closed'].map((status) => (
              <Button
                key={status}
                variant={filterStatus === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus(status)}
              >
                {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Loading tickets...</p>
        ) : filteredTickets.length > 0 ? (
          <div className="space-y-3">
            {filteredTickets.map((ticket: any) => (
              <Card key={ticket.id} className="border-l-4" style={{ borderLeftColor: ticket.priority === 'urgent' ? '#ef4444' : ticket.priority === 'high' ? '#f97316' : '#6366f1' }}>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-xs ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${getStatusColor(ticket.status)}`}>
                            {ticket.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <h4 className="font-semibold text-base">{ticket.subject}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{ticket.description}</p>
                      </div>
                      <Link href={`/complaints/${ticket.complaint_id}`}>
                        <Button variant="ghost" size="sm" title="View complaint">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-2">
                      <span>Complaint: <strong>{ticket.complaint_reference}</strong></span>
                      <span>Raised by: <strong>{ticket.raised_by_name}</strong></span>
                      <span>Created: {format(new Date(ticket.created_at), 'PP p')}</span>
                      {ticket.comment_count > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {ticket.comment_count} comment{ticket.comment_count > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Response Form */}
                    {respondingToTicket === ticket.id ? (
                      <div className="border-t pt-3 space-y-2">
                        <Textarea
                          placeholder="Add your response or update..."
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          rows={4}
                        />
                        <div className="flex items-center gap-2">
                          <select
                            className="border rounded px-2 py-1 text-sm"
                            onChange={(e) => {
                              updateTicket.mutate({
                                id: ticket.id,
                                status: e.target.value as any,
                              });
                            }}
                            defaultValue={ticket.status}
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>
                          <div className="flex-1" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRespondingToTicket(null);
                              setResponseText('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (responseText.trim()) {
                                addComment.mutate({
                                  ticketId: ticket.id,
                                  comment: responseText.trim(),
                                });
                              }
                            }}
                            disabled={!responseText.trim() || addComment.isPending}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            {addComment.isPending ? 'Sending...' : 'Send'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRespondingToTicket(ticket.id)}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Respond
                        </Button>
                        {ticket.status === 'open' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              updateTicket.mutate({
                                id: ticket.id,
                                status: 'in_progress',
                              });
                            }}
                          >
                            <Clock className="h-4 w-4 mr-2" />
                            Mark In Progress
                          </Button>
                        )}
                        {(ticket.status === 'open' || ticket.status === 'in_progress') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              updateTicket.mutate({
                                id: ticket.id,
                                status: 'resolved',
                              });
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark Resolved
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-muted-foreground">
            No {filterStatus !== 'all' && filterStatus} tickets found
          </p>
        )}
      </CardContent>
    </Card>
  );
}

