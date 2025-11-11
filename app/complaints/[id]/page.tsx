'use client';

import { trpc } from '@/lib/trpc/Provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DocumentUploader } from '@/components/complaint/DocumentUploader';
import { TimelineView } from '@/components/complaint/TimelineView';
import { OCRFailureCard } from '@/components/complaint/OCRFailureCard';
import { StatusManager } from '@/components/complaint/StatusManager';
import { TimeTracker } from '@/components/complaint/TimeTracker';
import { ResponseUploader } from '@/components/complaint/ResponseUploader';
import { FollowUpManager } from '@/components/complaint/FollowUpManager';
import { ViolationChecker } from '@/components/analysis/ViolationChecker';
import { PrecedentMatcher } from '@/components/analysis/PrecedentMatcher';
import { ReAnalysisPrompt } from '@/components/analysis/ReAnalysisPrompt';
import { LetterPreview } from '@/components/complaint/LetterPreview';
import { LetterManager } from '@/components/complaint/LetterManager';
import { getPracticeLetterhead } from '@/lib/practiceSettings';
import Link from 'next/link';
import { ArrowLeft, FileText, Sparkles, Send } from 'lucide-react';
import { useState } from 'react';

export default function ComplaintDetailPage({ params }: { params: { id: string } }) {
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [generatedLetter, setGeneratedLetter] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: complaint, isLoading } = trpc.complaints.getById.useQuery(params.id);
  const { data: documents } = trpc.documents.list.useQuery(params.id);
  const { data: timeData } = trpc.time.getComplaintTime.useQuery(params.id);
  const { data: savedLetters } = trpc.letters.list.useQuery({ complaintId: params.id });

  // Get practice settings for charge-out rate
  const practiceSettings = typeof window !== 'undefined' ? 
    JSON.parse(localStorage.getItem('lightpoint_practice_settings') || 'null') : null;

  // Auto-log time for analysis
  const logTime = trpc.time.logActivity.useMutation();

  const retryOCR = trpc.documents.retryOCR.useMutation({
    onSuccess: () => {
      // Refresh documents list
      utils.documents.list.invalidate(params.id);
      alert('OCR retry complete! Check the document again.');
    },
    onError: (error) => {
      alert(`OCR retry failed: ${error.message}`);
    },
  });

  const analyzeDocument = trpc.analysis.analyzeDocument.useMutation({
    onSuccess: (data) => {
      console.log('✅ Analysis complete:', data);
      setAnalysisData(data);
      
      // Auto-log time for analysis (based on document count)
      const docCount = (documents as any[] || []).length;
      const estimatedMinutes = Math.min(30 + (docCount * 10), 60); // 30-60 minutes
      
      logTime.mutate({
        complaintId: params.id,
        activity: 'Initial Analysis',
        duration: estimatedMinutes,
        rate: practiceSettings?.chargeOutRate || 250,
      });
    },
    onError: (error) => {
      console.error('❌ Analysis failed:', error);
      alert(`Analysis failed: ${error.message}`);
    },
  });

  const addToPrecedents = trpc.knowledge.addPrecedent.useMutation({
    onSuccess: () => {
      alert('Successfully added to precedent library! This will help with future similar complaints.');
    },
    onError: (error) => {
      alert(`Failed to add to precedents: ${error.message}`);
    },
  });

  const generateLetter = trpc.letters.generateComplaint.useMutation({
    onSuccess: (data) => {
      setGeneratedLetter(data.letter);
      
      // Auto-log time for letter generation
      logTime.mutate({
        complaintId: params.id,
        activity: 'Letter Generation',
        duration: 20,
        rate: practiceSettings?.chargeOutRate || 250,
      });
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

  const handleReAnalyze = (additionalContext: string) => {
    if (documents && documents.length > 0) {
      const firstDocId = (documents as any[])[0].id;
      console.log(`🔄 Re-analyzing with additional context`);
      analyzeDocument.mutate({ 
        documentId: firstDocId,
        additionalContext 
      });
    }
  };

  const handleAddToPrecedents = (notes: string) => {
    if (!analysisData) return;
    
    // Create a summary of the complaint for the precedent
    const complaintData = complaint as any;
    const title = `${complaintData.complaint_reference} - Novel Complaint Type`;
    const content = `
Complaint Reference: ${complaintData.complaint_reference}
Client: ${complaintData.client_name_encrypted || 'Client'}
Type: ${complaintData.complaint_type || 'General'}

Analysis Summary:
${JSON.stringify(analysisData.analysis, null, 2)}

User Notes:
${notes}

This precedent was manually added because it represents a novel complaint type not initially recognized by the system.
    `.trim();
    
    addToPrecedents.mutate({
      complaintId: params.id,
      title,
      content,
      notes,
      category: 'precedents',
    });
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

      <main className="container mx-auto px-4 py-8 max-w-7xl">
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

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Status, Actions & Time */}
          <div className="xl:col-span-1 space-y-6">
            {/* Status Manager */}
            <StatusManager
              complaintId={params.id}
              currentStatus={complaintData.status}
              onStatusChange={() => {
                utils.complaints.getById.invalidate(params.id);
              }}
            />

            {/* Document Uploader - only for assessment/active */}
            {(complaintData.status === 'assessment' || complaintData.status === 'active') && (
              <DocumentUploader complaintId={params.id} />
            )}

            {/* Actions - only for assessment */}
            {complaintData.status === 'assessment' && (
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
                </CardContent>
              </Card>
            )}

            {/* Response Uploader - only for active complaints */}
            {complaintData.status === 'active' && (
              <ResponseUploader
                complaintId={params.id}
                onResponseUploaded={() => {
                  utils.documents.list.invalidate(params.id);
                  utils.time.getComplaintTime.invalidate(params.id);
                }}
              />
            )}

            {/* Follow-Up Manager - for active/escalated complaints */}
            {(complaintData.status === 'active' || complaintData.status === 'escalated') && savedLetters && (savedLetters as any[]).length > 0 && (
              <FollowUpManager
                complaintId={params.id}
                lastLetterDate={(savedLetters as any[])[0]?.created_at}
                hasResponse={documents && (documents as any[]).some((d: any) => d.document_type === 'response')}
                onFollowUpGenerated={() => {
                  utils.letters.list.invalidate(params.id);
                  utils.time.getComplaintTime.invalidate(params.id);
                }}
              />
            )}

            {/* Time Tracker */}
            <TimeTracker
              complaintId={params.id}
              entries={timeData?.logs?.map((log: any) => ({
                activity: log.activity_type,
                duration: log.duration_minutes,
                rate: log.hourly_rate,
                date: log.logged_at,
              })) || []}
              chargeOutRate={practiceSettings?.chargeOutRate || 250}
            />
          </div>

          {/* Right Column - Analysis & Timeline */}
          <div className="xl:col-span-2 space-y-6">
            {/* OCR Failure warnings */}
            {documents && (documents as any[]).map((doc) => (
              <OCRFailureCard
                key={doc.id}
                document={doc}
                onRetryOCR={(id) => retryOCR.mutate(id)}
                isRetrying={retryOCR.isPending}
              />
            ))}
            
            {analysisData && (
              <>
                <ViolationChecker analysis={analysisData.analysis} />
                <PrecedentMatcher precedents={analysisData.precedents} />
                
                {/* Re-analysis prompt for low viability */}
                <ReAnalysisPrompt
                  analysis={analysisData.analysis}
                  onReAnalyze={handleReAnalyze}
                  onAddToPrecedents={handleAddToPrecedents}
                  isReAnalyzing={analyzeDocument.isPending}
                  isAddingToPrecedents={addToPrecedents.isPending}
                />
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

