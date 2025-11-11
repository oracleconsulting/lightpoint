'use client';

import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, Clock, AlertCircle, FileText, Download, Eye } from 'lucide-react';
import { useState } from 'react';
import { DocumentViewer } from './DocumentViewer';
import { trpc } from '@/lib/trpc/Provider';

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
  file_path: string;  // Supabase storage path
}

interface Letter {
  id: string;
  letter_type: string;
  created_at: string;
  locked_at?: string;
  sent_at?: string;
  letter_content: string;
}

interface TimelineViewProps {
  events: TimelineEvent[];
  documents?: Document[];
  letters?: Letter[];
}

export function TimelineView({ events, documents = [], letters = [] }: TimelineViewProps) {
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);

  // Fetch signed URL when viewing a document
  const { data: signedUrlData, isLoading: isLoadingUrl, error: urlError } = trpc.documents.getSignedUrl.useQuery(
    viewingDoc?.file_path || '',
    { 
      enabled: !!viewingDoc,
      retry: 1
    }
  );

  console.log('TimelineView state:', { 
    viewingDoc: viewingDoc?.filename, 
    filePath: viewingDoc?.file_path,
    signedUrlData: signedUrlData?.signedUrl?.substring(0, 50),
    isLoadingUrl,
    urlError 
  });

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
      case 'letter':
        return <FileText className="h-5 w-5 text-green-600" />;
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

  // Convert documents to timeline events
  const documentEvents = documents.map(doc => ({
    date: doc.uploaded_at,
    type: 'document' as const,
    summary: `Document uploaded: ${doc.filename}`,
    documentData: doc,
  }));

  // Convert letters to timeline events
  const letterEvents = letters.map(letter => ({
    date: letter.created_at,
    type: 'letter' as const,
    summary: `${letter.letter_type.replace(/_/g, ' ').toUpperCase()} generated`,
    letterData: letter,
  }));

  // Merge and sort all events chronologically (union type for type safety)
  type MergedEvent = TimelineEvent | (typeof documentEvents)[0] | (typeof letterEvents)[0];
  const allEvents: MergedEvent[] = [...events, ...documentEvents, ...letterEvents].sort((a, b) => 
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
                              onClick={() => {
                                console.log('View button clicked:', (event as any).documentData);
                                setViewingDoc((event as any).documentData);
                              }}
                              title="View document"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                // Generate signed URL for download
                                const response = await fetch(`/api/trpc/documents.getSignedUrl?input=${encodeURIComponent(JSON.stringify((event as any).documentData.file_path))}`);
                                const result = await response.json();
                                if (result.result?.data?.signedUrl) {
                                  window.open(result.result.data.signedUrl, '_blank');
                                }
                              }}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Inline document viewer */}
                        {viewingDoc && viewingDoc.id === (event as any).documentData.id && (
                          <>
                            {isLoadingUrl && (
                              <div className="mt-3 p-4 bg-muted rounded text-center">
                                <p className="text-sm text-muted-foreground">Loading document...</p>
                              </div>
                            )}
                            {urlError && (
                              <div className="mt-3 p-4 bg-destructive/10 rounded">
                                <p className="text-sm text-destructive">Failed to load document: {(urlError as any).message}</p>
                              </div>
                            )}
                            {signedUrlData && (
                              <DocumentViewer
                                filename={viewingDoc.filename}
                                fileType={viewingDoc.file_type}
                                storageUrl={signedUrlData.signedUrl}
                                onClose={() => setViewingDoc(null)}
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Letter details */}
                    {event.type === 'letter' && (event as any).letterData && (
                      <div className="mt-3 border rounded-lg p-4 bg-green-50/50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="h-5 w-5 text-green-600" />
                              <span className="font-semibold text-green-900">
                                {(event as any).letterData.letter_type.replace(/_/g, ' ').toUpperCase()}
                              </span>
                              {(event as any).letterData.locked_at && (
                                <Badge variant="outline" className="bg-blue-100 text-blue-700">
                                  🔒 Locked
                                </Badge>
                              )}
                              {(event as any).letterData.sent_at && (
                                <Badge variant="outline" className="bg-green-100 text-green-700">
                                  ✉️ Sent
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                              {(event as any).letterData.letter_content.substring(0, 200)}...
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Create a modal/new window to show full letter
                                const letterWindow = window.open('', '_blank', 'width=800,height=600');
                                if (letterWindow) {
                                  letterWindow.document.write(`
                                    <!DOCTYPE html>
                                    <html>
                                    <head>
                                      <title>${(event as any).letterData.letter_type.replace(/_/g, ' ').toUpperCase()}</title>
                                      <style>
                                        body {
                                          font-family: 'Times New Roman', serif;
                                          max-width: 800px;
                                          margin: 40px auto;
                                          padding: 20px;
                                          line-height: 1.6;
                                          color: #333;
                                        }
                                        h1 {
                                          color: #2563eb;
                                          margin-bottom: 20px;
                                        }
                                        .meta {
                                          color: #666;
                                          font-size: 0.9em;
                                          margin-bottom: 30px;
                                          padding-bottom: 10px;
                                          border-bottom: 2px solid #e5e7eb;
                                        }
                                        .content {
                                          white-space: pre-wrap;
                                        }
                                        .print-btn {
                                          position: fixed;
                                          top: 20px;
                                          right: 20px;
                                          padding: 10px 20px;
                                          background: #2563eb;
                                          color: white;
                                          border: none;
                                          border-radius: 6px;
                                          cursor: pointer;
                                          font-size: 14px;
                                        }
                                        .print-btn:hover {
                                          background: #1d4ed8;
                                        }
                                        @media print {
                                          .print-btn { display: none; }
                                        }
                                      </style>
                                    </head>
                                    <body>
                                      <button class="print-btn" onclick="window.print()">🖨️ Print Letter</button>
                                      <h1>${(event as any).letterData.letter_type.replace(/_/g, ' ').toUpperCase()}</h1>
                                      <div class="meta">
                                        Generated: ${format(new Date((event as any).letterData.created_at), 'PPP p')}<br>
                                        ${(event as any).letterData.locked_at ? '🔒 Locked' : ''} 
                                        ${(event as any).letterData.sent_at ? '✉️ Sent' : ''}
                                      </div>
                                      <div class="content">${(event as any).letterData.letter_content}</div>
                                    </body>
                                    </html>
                                  `);
                                  letterWindow.document.close();
                                }
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Full Letter
                            </Button>
                          </div>
                        </div>
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
                    {event.type === 'document' ? 'uploaded' : event.type === 'letter' ? 'generated' : event.type}
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

