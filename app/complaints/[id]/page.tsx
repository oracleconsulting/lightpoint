'use client';

import { trpc } from '@/lib/trpc/Provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DocumentUploader } from '@/components/complaint/DocumentUploader';
import { TimelineView } from '@/components/complaint/TimelineView';
import { ViolationChecker } from '@/components/analysis/ViolationChecker';
import { PrecedentMatcher } from '@/components/analysis/PrecedentMatcher';
import { LetterPreview } from '@/components/complaint/LetterPreview';
import Link from 'next/link';
import { ArrowLeft, FileText, Sparkles, Send } from 'lucide-react';
import { useState } from 'react';

export default function ComplaintDetailPage({ params }: { params: { id: string } }) {
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [generatedLetter, setGeneratedLetter] = useState<string | null>(null);

  const { data: complaint, isLoading } = trpc.complaints.getById.useQuery(params.id);
  const { data: documents } = trpc.documents.list.useQuery(params.id);
  const { data: timeData } = trpc.time.getComplaintTime.useQuery(params.id);

  const analyzeDocument = trpc.analysis.analyzeDocument.useMutation({
    onSuccess: (data) => {
      setAnalysisData(data);
    },
  });

  const generateLetter = trpc.letters.generateComplaint.useMutation({
    onSuccess: (data) => {
      setGeneratedLetter(data.letter);
    },
  });

  const handleAnalyze = () => {
    if (documents && documents.length > 0) {
      // Type assertion since we know documents exist at this point
      analyzeDocument.mutate({ documentId: (documents as any[])[0].id });
    }
  };

  const handleGenerateLetter = () => {
    if (analysisData) {
      generateLetter.mutate({
        complaintId: params.id,
        analysis: analysisData.analysis,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading complaint...</p>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Complaint not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Complaint Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">{complaint.client_reference}</h1>
              <p className="text-muted-foreground">
                {complaint.hmrc_department} • {complaint.complaint_type}
              </p>
            </div>
            <Badge>{complaint.status}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Documents & Actions */}
          <div className="lg:col-span-1 space-y-6">
            <DocumentUploader complaintId={params.id} />

            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={handleAnalyze}
                  disabled={!documents || documents.length === 0 || analyzeDocument.isPending}
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {analyzeDocument.isPending ? 'Analyzing...' : 'Analyze Complaint'}
                </Button>

                <Button 
                  onClick={handleGenerateLetter}
                  disabled={!analysisData || generateLetter.isPending}
                  className="w-full"
                  variant="outline"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {generateLetter.isPending ? 'Generating...' : 'Generate Letter'}
                </Button>

                <Button disabled className="w-full" variant="outline">
                  <Send className="h-4 w-4 mr-2" />
                  Send to Client
                </Button>
              </CardContent>
            </Card>

            {timeData && (
              <Card>
                <CardHeader>
                  <CardTitle>Time Tracking</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Time:</span>
                      <span className="font-medium">{timeData.totalHours}h</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Activities:</span>
                      <span className="font-medium">{timeData.logs.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Analysis & Timeline */}
          <div className="lg:col-span-2 space-y-6">
            {analysisData && (
              <>
                <ViolationChecker analysis={analysisData.analysis} />
                <PrecedentMatcher precedents={analysisData.precedents} />
              </>
            )}

            {generatedLetter && (
              <LetterPreview letter={generatedLetter} />
            )}

            <TimelineView events={complaint.timeline || []} />

            {!analysisData && !generatedLetter && (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Upload documents and run analysis to get started
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

