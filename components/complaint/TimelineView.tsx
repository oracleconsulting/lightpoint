'use client';

import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, Clock, AlertCircle, FileText, Download, Eye } from 'lucide-react';
import { useState } from 'react';
import { DocumentViewer } from './DocumentViewer';

interface TimelineEvent {
  date: string;
  type: string;
  summary: string;
  responseDeadline?: string;
}

interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  storage_path: string;
}

interface TimelineViewProps {
  events: TimelineEvent[];
  documents?: Document[];
}

export function TimelineView({ events, documents = [] }: TimelineViewProps) {
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'sent':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case 'received':
        return <Circle className="h-5 w-5 text-green-500" />;
      case 'internal':
        return <Clock className="h-5 w-5 text-gray-500" />;
      case 'document':
        return <FileText className="h-5 w-5 text-purple-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const isOverdue = (deadline?: string) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileTypeColor = (fileType: string) => {
    const type = fileType?.toLowerCase() || '';
    if (type.includes('pdf')) return 'bg-red-100 text-red-700';
    if (type.includes('image')) return 'bg-blue-100 text-blue-700';
    if (type.includes('doc')) return 'bg-indigo-100 text-indigo-700';
    if (type.includes('xls') || type.includes('csv')) return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-700';
  };

  // Convert documents to timeline events and merge with existing events
  const documentEvents = documents.map(doc => ({
    date: doc.uploaded_at,
    type: 'document' as const,
    summary: `Document uploaded: ${doc.filename}`,
    documentData: doc,
  }));

  // Merge and sort all events chronologically (union type for type safety)
  type MergedEvent = TimelineEvent | (typeof documentEvents)[0];
  const allEvents: MergedEvent[] = [...events, ...documentEvents].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {allEvents.map((event, index) => (
            <div key={index} className="flex gap-4">
              <div className="flex-shrink-0 mt-1">
                {getEventIcon(event.type)}
              </div>
              <div className="flex-1 pb-4 border-l-2 border-border pl-4 ml-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{event.summary}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.date), 'PPP p')}
                    </p>
                    
                    {/* Document details */}
                    {event.type === 'document' && (event as any).documentData && (
                      <div className="mt-3 border rounded-lg p-3 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {(event as any).documentData.filename}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${getFileTypeColor((event as any).documentData.file_type)}`}
                                >
                                  {(event as any).documentData.file_type?.toUpperCase() || 'FILE'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatFileSize((event as any).documentData.file_size)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingDoc((event as any).documentData)}
                              title="View document"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Download document
                                const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/complaint-documents/${(event as any).documentData.storage_path}`;
                                window.open(publicUrl, '_blank');
                              }}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Inline document viewer */}
                        {viewingDoc && viewingDoc.id === (event as any).documentData.id && (
                          <DocumentViewer
                            filename={viewingDoc.filename}
                            fileType={viewingDoc.file_type}
                            storageUrl={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/complaint-documents/${viewingDoc.storage_path}`}
                            onClose={() => setViewingDoc(null)}
                          />
                        )}
                      </div>
                    )}
                    
                    {/* Response deadline (only for non-document events) */}
                    {'responseDeadline' in event && event.responseDeadline && (
                      <div className="mt-2">
                        <Badge variant={isOverdue(event.responseDeadline) ? "destructive" : "secondary"}>
                          Response due: {format(new Date(event.responseDeadline), 'PP')}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="ml-2">
                    {event.type === 'document' ? 'uploaded' : event.type}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
          {allEvents.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No timeline events yet. Upload documents to get started.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

