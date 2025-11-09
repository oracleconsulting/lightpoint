'use client';

import { useState } from 'react';
import { ComplaintWizard } from '@/components/complaint/ComplaintWizard';
import { BatchAssessment } from '@/components/complaint/BatchAssessment';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, FileText, FolderOpen } from 'lucide-react';

// Mock data - replace with actual auth
const MOCK_ORGANIZATION_ID = 'org-1';
const MOCK_USER_ID = 'user-1';

export default function NewComplaintPage() {
  const [mode, setMode] = useState<'select' | 'single' | 'batch'>('select');

  return (
    <div className="min-h-screen bg-background">
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
        {mode === 'select' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Create New Complaint</h1>
              <p className="text-muted-foreground">
                Choose how you'd like to proceed
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Single Complaint Option */}
              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setMode('single')}>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Single Complaint</CardTitle>
                  </div>
                  <CardDescription className="text-sm">
                    Create a complaint about one specific issue with HMRC
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>✓ Upload multiple documents about <strong>one issue</strong></li>
                    <li>✓ Provide context for the whole case</li>
                    <li>✓ AI analyzes all documents together</li>
                    <li>✓ Generates one formal complaint letter</li>
                  </ul>
                  <Button className="w-full mt-4" onClick={() => setMode('single')}>
                    Start Single Complaint
                  </Button>
                </CardContent>
              </Card>

              {/* Batch Assessment Option */}
              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setMode('batch')}>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <FolderOpen className="h-6 w-6 text-blue-500" />
                    </div>
                    <CardTitle>Batch Assessment</CardTitle>
                  </div>
                  <CardDescription className="text-sm">
                    Upload multiple documents to assess for potential complaints
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>✓ Upload many documents about <strong>different issues</strong></li>
                    <li>✓ Optional: Add context for each document</li>
                    <li>✓ AI assesses each document independently</li>
                    <li>✓ Shows which ones have complaint grounds</li>
                  </ul>
                  <Button variant="secondary" className="w-full mt-4" onClick={() => setMode('batch')}>
                    Start Batch Assessment
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Not sure which to choose?</strong><br />
                • Use <strong>Single Complaint</strong> if you have a specific issue (e.g., delayed VAT repayment with 10 chase letters)<br />
                • Use <strong>Batch Assessment</strong> if you have many unrelated HMRC letters and want to see which ones might have complaint grounds
              </p>
            </div>
          </div>
        )}

        {mode === 'single' && (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setMode('select')} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Selection
            </Button>
            <ComplaintWizard 
              organizationId={MOCK_ORGANIZATION_ID}
              userId={MOCK_USER_ID}
            />
          </div>
        )}

        {mode === 'batch' && (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setMode('select')} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Selection
            </Button>
            <BatchAssessment 
              organizationId={MOCK_ORGANIZATION_ID}
              userId={MOCK_USER_ID}
            />
          </div>
        )}
      </main>
    </div>
  );
}

