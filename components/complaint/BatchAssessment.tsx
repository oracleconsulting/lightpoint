'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, X, FileText, AlertCircle, CheckCircle2, Clock, Sparkles, FolderOpen } from 'lucide-react';
import Image from 'next/image';

interface BatchAssessmentProps {
  organizationId: string;
  userId: string;
}

interface UploadedDocument {
  id: string;
  file: File;
  thumbnail?: string;
  context: string;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  analysis?: {
    hasComplaintGrounds: boolean;
    summary: string;
    violations: string[];
    confidence: number;
  };
}

export function BatchAssessment({ organizationId, userId }: BatchAssessmentProps) {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const newDocuments: UploadedDocument[] = newFiles.map((file, index) => ({
        id: `${Date.now()}-${index}`,
        file,
        context: '',
        status: 'pending',
      }));
      setDocuments([...documents, ...newDocuments]);
    }
  };

  const removeDocument = (id: string) => {
    setDocuments(documents.filter(doc => doc.id !== id));
  };

  const updateContext = (id: string, context: string) => {
    setDocuments(documents.map(doc => 
      doc.id === id ? { ...doc, context } : doc
    ));
  };

  const analyzeAll = async () => {
    setIsAnalyzing(true);
    // TODO: Implement actual AI analysis
    // For now, just simulate analysis
    for (const doc of documents) {
      setDocuments(prev => prev.map(d => 
        d.id === doc.id ? { ...d, status: 'analyzing' } : d
      ));
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock analysis result
      const mockAnalysis = {
        hasComplaintGrounds: Math.random() > 0.4,
        summary: 'AI detected potential unreasonable delay in VAT repayment processing. HMRC Charter commitment 1.2 may have been breached.',
        violations: ['Unreasonable delay', 'Failure to respond within timeframe'],
        confidence: Math.random() * 0.3 + 0.7,
      };
      
      setDocuments(prev => prev.map(d => 
        d.id === doc.id ? { ...d, status: 'complete', analysis: mockAnalysis } : d
      ));
    }
    setIsAnalyzing(false);
  };

  const analyzeSingle = async (id: string) => {
    // Similar to analyzeAll but for single document
    setDocuments(prev => prev.map(d => 
      d.id === id ? { ...d, status: 'analyzing' } : d
    ));
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockAnalysis = {
      hasComplaintGrounds: Math.random() > 0.4,
      summary: 'AI detected potential unreasonable delay in VAT repayment processing. HMRC Charter commitment 1.2 may have been breached.',
      violations: ['Unreasonable delay', 'Failure to respond within timeframe'],
      confidence: Math.random() * 0.3 + 0.7,
    };
    
    setDocuments(prev => prev.map(d => 
      d.id === id ? { ...d, status: 'complete', analysis: mockAnalysis } : d
    ));
  };

  const createComplaintFromDocument = (doc: UploadedDocument) => {
    // TODO: Navigate to complaint creation with pre-filled data
    console.log('Creating complaint from document:', doc);
  };

  const getStatusIcon = (status: UploadedDocument['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'analyzing':
        return <Sparkles className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Batch Assessment</h1>
          <p className="text-muted-foreground mt-1">
            Upload multiple documents to assess for potential complaint grounds
          </p>
        </div>
        {documents.length > 0 && (
          <Button 
            onClick={analyzeAll}
            disabled={isAnalyzing || documents.every(d => d.status === 'complete')}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Analyze All Documents
          </Button>
        )}
      </div>

      {/* Upload Area */}
      <Card>
        <CardContent className="pt-6">
          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.webp"
              onChange={handleFileSelect}
              className="hidden"
              id="batch-file-upload"
            />
            <label htmlFor="batch-file-upload" className="cursor-pointer">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm font-medium">Click to upload or drag and drop</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload multiple HMRC documents • PDF, DOC, DOCX • Max 10MB per file
              </p>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Documents Grid */}
      {documents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Uploaded Documents ({documents.length})</h2>
            <div className="flex gap-2">
              <Badge variant="outline">
                {documents.filter(d => d.status === 'complete').length} analyzed
              </Badge>
              <Badge variant="outline">
                {documents.filter(d => d.status === 'complete' && d.analysis?.hasComplaintGrounds).length} with grounds
              </Badge>
            </div>
          </div>

          <div className="grid gap-4">
            {documents.map((doc) => (
              <Card key={doc.id} className={
                doc.analysis?.hasComplaintGrounds 
                  ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20'
                  : doc.status === 'complete'
                  ? 'border-muted'
                  : ''
              }>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Document Preview/Thumbnail */}
                    <div className="flex-shrink-0">
                      <div className="w-24 h-32 bg-muted rounded border flex items-center justify-center">
                        <FileText className="h-12 w-12 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Document Details */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{doc.file.name}</p>
                            {getStatusIcon(doc.status)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {(doc.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDocument(doc.id)}
                          disabled={isAnalyzing}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Context Input */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          Context (optional)
                        </label>
                        <textarea
                          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                          placeholder="Add context for this specific document (e.g., 'Penalty notice for late VAT return - but we submitted on time')"
                          value={doc.context}
                          onChange={(e) => updateContext(doc.id, e.target.value)}
                          disabled={doc.status !== 'pending'}
                        />
                      </div>

                      {/* Analysis Result */}
                      {doc.status === 'complete' && doc.analysis && (
                        <div className="space-y-2 pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {doc.analysis.hasComplaintGrounds ? (
                                <Badge className="bg-green-600">
                                  ✓ Complaint Grounds Found
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  No Clear Complaint Grounds
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {Math.round(doc.analysis.confidence * 100)}% confidence
                              </span>
                            </div>
                            {doc.analysis.hasComplaintGrounds && (
                              <Button 
                                size="sm"
                                onClick={() => createComplaintFromDocument(doc)}
                              >
                                Create Complaint
                              </Button>
                            )}
                          </div>
                          <p className="text-sm">{doc.analysis.summary}</p>
                          {doc.analysis.violations.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {doc.analysis.violations.map((violation, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {violation}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Analyze Button for Individual Document */}
                      {doc.status === 'pending' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => analyzeSingle(doc.id)}
                          className="gap-2"
                        >
                          <Sparkles className="h-3 w-3" />
                          Analyze This Document
                        </Button>
                      )}

                      {doc.status === 'analyzing' && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Sparkles className="h-4 w-4 animate-pulse" />
                          Analyzing against HMRC Charter and precedents...
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {documents.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No documents uploaded yet. Upload documents to get started.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

