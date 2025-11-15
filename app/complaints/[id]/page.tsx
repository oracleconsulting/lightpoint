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
import { ManualTimeEntry } from '@/components/time/ManualTimeEntry';
import { AssignComplaint } from '@/components/complaint/AssignComplaint';
import { FlagToManagement, ComplaintTickets } from '@/components/tickets/FlagToManagement';
import { ResponseUploader } from '@/components/complaint/ResponseUploader';
import { FollowUpManager } from '@/components/complaint/FollowUpManager';
import { ViolationChecker } from '@/components/analysis/ViolationChecker';
import { PrecedentMatcher } from '@/components/analysis/PrecedentMatcher';
import { ReAnalysisPrompt } from '@/components/analysis/ReAnalysisPrompt';
import { LetterPreview } from '@/components/complaint/LetterPreview';
import { LetterManager } from '@/components/complaint/LetterManager';
import { LetterRefinement } from '@/components/letter/LetterRefinement';
import { StartComplaint } from '@/components/complaint/StartComplaint';
import { getPracticeLetterhead } from '@/lib/practiceSettings';
import { calculateLetterTime, calculateAnalysisTime, TIME_BENCHMARKS } from '@/lib/timeCalculations';
import Link from 'next/link';
import { ArrowLeft, FileText, Sparkles, Send, Edit2, Check, X } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useUser } from '@/contexts/UserContext';

export default function ComplaintDetailPage({ params }: { params: { id: string } }) {
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [generatedLetter, setGeneratedLetter] = useState<string | null>(null);
  const [isEditingReference, setIsEditingReference] = useState(false);
  const [editedReference, setEditedReference] = useState('');

  const { currentUser } = useUser();
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
  const deleteTimeByType = trpc.time.deleteActivityByType.useMutation();
  const updateReference = trpc.complaints.updateReference.useMutation({
    onSuccess: () => {
      setIsEditingReference(false);
      utils.complaints.getById.invalidate(params.id);
    },
    onError: (error) => {
      alert(`Failed to update reference: ${error.message}`);
    }
  });

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
      const { minutes, description } = calculateAnalysisTime(docCount);
      
      logTime.mutate({
        complaintId: params.id,
        activity: 'Initial Analysis',
        duration: minutes,
        rate: practiceSettings?.chargeOutRate || 250,
      });
      
      console.log(`⏱️ Logged ${minutes} minutes for ${description}`);
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
      console.log('✅ Letter generation succeeded!');
      setGeneratedLetter(data.letter);
      
      // Auto-log time for letter generation (based on page count)
      const { minutes, description, pages } = calculateLetterTime(data.letter);
      
      logTime.mutate({
        complaintId: params.id,
        activity: 'Letter Generation',
        duration: minutes,
        rate: practiceSettings?.chargeOutRate || 250,
      });
      
      console.log(`⏱️ Logged ${minutes} minutes for ${pages}-page letter (${description})`);
    },
    onError: (error) => {
      console.error('❌ Letter generation failed:', error);
      alert(`Failed to generate letter: ${error.message}`);
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
    console.log('🔄 Generate Letter button clicked');
    console.log('Analysis data:', analysisData ? 'Available' : 'Missing');
    console.log('Current user:', currentUser);
    
    if (!analysisData) {
      console.error('❌ Cannot generate letter: No analysis data');
      return;
    }
    
    // Get practice letterhead if configured
    const practiceLetterhead = getPracticeLetterhead();
    console.log('Practice letterhead:', practiceLetterhead);
    
    // Get practice settings for charge-out rate
    const practiceSettings = typeof window !== 'undefined' ? 
      JSON.parse(localStorage.getItem('lightpoint_practice_settings') || 'null') : null;
    console.log('Practice settings:', practiceSettings);
    
    const letterParams = {
      complaintId: params.id,
      analysis: analysisData.analysis,
      practiceLetterhead, // Pass practice details
      chargeOutRate: practiceSettings?.chargeOutRate, // Pass charge-out rate
      userName: currentUser?.full_name || currentUser?.email?.split('@')[0] || 'Professional',
      userTitle: currentUser?.job_title || 'Chartered Accountant',
      userEmail: currentUser?.email,
      userPhone: currentUser?.phone,
    };
    console.log('📤 Calling generateLetter with params:', letterParams);
    
    generateLetter.mutate(letterParams);
  };

  const handleRefineLetter = async (additionalContext: string) => {
    try {
      // Delete all old automated time logs for analysis and letter generation
      console.log('🗑️ Deleting old analysis and letter generation time logs');
      
      // Delete old analysis logs (both "analysis" and "Initial Analysis")
      await deleteTimeByType.mutateAsync({
        complaintId: params.id,
        activityType: 'analysis',
      }).catch(() => null);
      
      await deleteTimeByType.mutateAsync({
        complaintId: params.id,
        activityType: 'Initial Analysis',
      }).catch(() => null);
      
      // Delete old letter generation logs (all variations)
      await deleteTimeByType.mutateAsync({
        complaintId: params.id,
        activityType: 'letter_generation',
      }).catch(() => null);
      
      await deleteTimeByType.mutateAsync({
        complaintId: params.id,
        activityType: 'Letter Generation',
      }).catch(() => null);

      // Log time for letter refinement (12 minutes)
      await logTime.mutateAsync({
        complaintId: params.id,
        activity: 'Letter Refinement',
        duration: TIME_BENCHMARKS.LETTER_REFINEMENT,
        rate: practiceSettings?.chargeOutRate || 250,
      });

      console.log('✅ Old time logs deleted, refinement time logged');

      // Re-analyze with the new context
      if (documents && documents.length > 0) {
        const firstDocId = (documents as any[])[0].id;
        console.log(`🔄 Re-analyzing with refinement context`);
        
        analyzeDocument.mutate({ 
          documentId: firstDocId,
          additionalContext 
        }, {
          onSuccess: (newAnalysis) => {
            // Auto-generate letter with new analysis
            console.log('✨ Auto-generating refined letter');
            setAnalysisData(newAnalysis);
            
            const practiceLetterhead = getPracticeLetterhead();
            const practiceSettings = typeof window !== 'undefined' ? 
              JSON.parse(localStorage.getItem('lightpoint_practice_settings') || 'null') : null;
            
            generateLetter.mutate({
              complaintId: params.id,
              analysis: newAnalysis.analysis,
              practiceLetterhead,
              chargeOutRate: practiceSettings?.chargeOutRate,
              userName: currentUser?.full_name || currentUser?.email?.split('@')[0] || 'Professional',
              userTitle: currentUser?.job_title || 'Chartered Accountant',
              userEmail: currentUser?.email,
              userPhone: currentUser?.phone,
            });
            
            // Refresh time data after all operations
            utils.time.getComplaintTime.invalidate(params.id);
          }
        });
      }
    } catch (error) {
      console.error('Error in refinement:', error);
      alert('Failed to process refinement. Please try again.');
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
            <div className="flex-1">
              {!isEditingReference ? (
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold">{complaintData.complaint_reference}</h1>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditedReference(complaintData.complaint_reference);
                      setIsEditingReference(true);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedReference}
                    onChange={(e) => setEditedReference(e.target.value)}
                    className="text-3xl font-bold h-12 max-w-md"
                    placeholder="Client reference..."
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (editedReference.trim()) {
                        updateReference.mutate({
                          id: params.id,
                          complaint_reference: editedReference.trim(),
                        });
                      }
                    }}
                    disabled={!editedReference.trim() || updateReference.isPending}
                    className="text-green-600 hover:text-green-700"
                  >
                    <Check className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingReference(false)}
                    disabled={updateReference.isPending}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              )}
              <p className="text-muted-foreground mt-2">
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
                  utils.letters.list.invalidate({ complaintId: params.id });
                  utils.time.getComplaintTime.invalidate(params.id);
                }}
              />
            )}

            {/* Time Tracker */}
            <TimeTracker
              complaintId={params.id}
              entries={timeData?.logs?.map((log: any) => ({
                id: log.id, // Include ID for deletion
                activity: log.activity_type,
                duration: log.minutes_spent,
                rate: practiceSettings?.chargeOutRate || 250,
                date: log.created_at,
              })) || []}
              chargeOutRate={practiceSettings?.chargeOutRate || 250}
              onTimeDeleted={() => {
                utils.time.getComplaintTime.invalidate(params.id);
              }}
            />

            {/* Assign Complaint */}
            <AssignComplaint
              complaintId={params.id}
              currentAssignedTo={(complaint as any)?.assigned_to}
              onAssigned={() => {
                utils.complaints.getById.invalidate(params.id);
              }}
            />

            {/* Manual Time Entry */}
            <ManualTimeEntry
              complaintId={params.id}
              onTimeLogged={() => {
                utils.time.getComplaintTime.invalidate(params.id);
                utils.complaints.getById.invalidate(params.id); // Refresh timeline
              }}
            />

            {/* Flag to Management */}
            {complaint && (complaint as any).complaint_reference && (
              <>
                <ComplaintTickets complaintId={params.id} />
                <FlagToManagement
                  complaintId={params.id}
                  complaintReference={(complaint as any).complaint_reference}
                  onTicketCreated={() => {
                    utils.complaints.getById.invalidate(params.id);
                  }}
                />
              </>
            )}
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
                
                {/* Letter Refinement - add context and regenerate */}
                <LetterRefinement
                  onRefine={handleRefineLetter}
                  isRefining={analyzeDocument.isPending || generateLetter.isPending}
                />
                
                {/* Start Complaint Button */}
                <StartComplaint
                  complaintId={params.id}
                  hasGeneratedLetter={!!generatedLetter}
                  onComplaintStarted={() => {
                    utils.complaints.getById.invalidate(params.id);
                    utils.letters.list.invalidate({ complaintId: params.id });
                  }}
                />
                
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
              letters={savedLetters as any[]}
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

