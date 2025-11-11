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
import { LetterManager } from '@/components/complaint/LetterManager';
import { getPracticeLetterhead } from '@/lib/practiceSettings';
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
      console.log('✅ Analysis complete:', data);
      setAnalysisData(data);
    },
    onError: (error) => {
      console.error('❌ Analysis failed:', error);
      alert(`Analysis failed: ${error.message}`);
    },
  });

  const generateLetter = trpc.letters.generateComplaint.useMutation({
    onSuccess: (data) => {
      setGeneratedLetter(data.letter);
    },
  });

  const handleAnalyze = () => {
    console.log('🔍 Analyze button clicked');
    console.log('Documents:', documents);
    
    if (documents && documents.length > 0) {
      const firstDocId = (documents as any[])[0].id;
      console.log(`📄 Analyzing document: ${firstDocId}`);
      analyzeDocument.mutate({ documentId: firstDocId });
    } else {
      console.error('❌ No documents available to analyze');
      alert('No documents available. Please upload documents first.');
    }
  };

  const handleGenerateLetter = () => {
    if (analysisData) {
      // Get practice letterhead if configured
      const practiceLetterhead = getPracticeLetterhead();
      
      // Get practice settings for charge-out rate
      const practiceSettings = typeof window !== 'undefined' ? 
        JSON.parse(localStorage.getItem('lightpoint_practice_settings') || 'null') : null;
      
      generateLetter.mutate({
        complaintId: params.id,
        analysis: analysisData.analysis,
        practiceLetterhead, // Pass practice details
        chargeOutRate: practiceSettings?.chargeOutRate, // Pass charge-out rate
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

  // Type assertion for complaint to fix TypeScript inference
  const complaintData = complaint as any;

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
              <h1 className="text-3xl font-bold mb-2">{complaintData.complaint_reference}</h1>
              <p className="text-muted-foreground">
                {complaintData.client_name_encrypted || 'Client'} • {complaintData.status}
              </p>
            </div>
            <Badge>{complaintData.status}</Badge>
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
                      <span className="font-medium">{(timeData as any).totalHours}h</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Activities:</span>
                      <span className="font-medium">{(timeData as any).logs.length}</span>
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
              <>
                <LetterPreview letter={generatedLetter} />
                <LetterManager 
                  complaintId={params.id}
                  clientReference={complaintData.complaint_reference}
                  generatedLetter={generatedLetter}
                  onLetterSaved={() => setGeneratedLetter(null)}
                />
              </>
            )}

            {/* Always show saved letters */}
            {!generatedLetter && (
              <LetterManager 
                complaintId={params.id} 
                clientReference={complaintData.complaint_reference}
              />
            )}

            <TimelineView 
              events={complaintData.timeline || []} 
              documents={documents as any[]}
            />

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

