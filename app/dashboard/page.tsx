'use client';

import { trpc } from '@/lib/trpc/Provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Plus, FileText, AlertCircle, CheckCircle, TrendingUp, Clock } from 'lucide-react';

// Mock data for demo - replace with actual auth
const MOCK_ORGANIZATION_ID = 'org-1';

export default function DashboardPage() {
  const { data: complaints, isLoading } = trpc.complaints.list.useQuery({
    organizationId: MOCK_ORGANIZATION_ID,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      assessment: 'secondary',
      draft: 'secondary',
      active: 'default',
      escalated: 'destructive',
      resolved: 'default',
      closed: 'secondary',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'assessment':
        return <FileText className="h-5 w-5 text-blue-500" />;
      case 'active':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'escalated':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'resolved':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const stats = {
    total: complaints?.length || 0,
    active: complaints?.filter((c: any) => c.status === 'active').length || 0,
    escalated: complaints?.filter((c: any) => c.status === 'escalated').length || 0,
    resolved: complaints?.filter((c: any) => c.status === 'resolved').length || 0,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Lightpoint</h1>
            <p className="text-sm text-muted-foreground">HMRC Complaint Management</p>
          </div>
          <Link href="/complaints/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Complaint
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Complaints</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-3xl font-bold">{stats.active}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Escalated</p>
                  <p className="text-3xl font-bold">{stats.escalated}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                  <p className="text-3xl font-bold">{stats.resolved}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Complaints List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Complaints</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading complaints...</p>
            ) : complaints && complaints.length > 0 ? (
              <div className="space-y-4">
                {complaints.map((complaint: any) => (
                  <Link key={complaint.id} href={`/complaints/${complaint.id}`}>
                    <div className="border rounded-lg p-4 hover:bg-muted transition-colors cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getStatusIcon(complaint.status)}
                          <div>
                            <p className="font-medium">
                              {complaint.complaint_reference || 'Untitled Complaint'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {complaint.client_name_encrypted || 'Client'} • {complaint.status}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Created {new Date(complaint.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(complaint.status)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No complaints yet</p>
                <Link href="/complaints/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Complaint
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

