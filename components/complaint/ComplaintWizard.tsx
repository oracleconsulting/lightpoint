'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/Provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Upload, X, FileText } from 'lucide-react';

interface ComplaintWizardProps {
  organizationId: string;
  userId: string;
}

export function ComplaintWizard({ organizationId, userId }: ComplaintWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    clientReference: '',
    complaintContext: '',
  });

  const [isUploading, setIsUploading] = useState(false);

  const createComplaint = trpc.complaints.create.useMutation({
    onSuccess: async (data: any) => {
      console.log('✅ Complaint created:', data);
      
      // After creating complaint, upload all documents
      if (files.length > 0) {
        setIsUploading(true);
        console.log(`📤 Uploading ${files.length} documents...`);
        
        try {
          for (const file of files) {
            console.log(`Uploading: ${file.name}`);
            const formData = new FormData();
            formData.append('file', file);
            formData.append('complaintId', data.id);
            formData.append('documentType', 'evidence');

            const response = await fetch('/api/documents/upload', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) {
              console.error(`❌ Failed to upload ${file.name}:`, await response.text());
            } else {
              console.log(`✅ Uploaded ${file.name}`);
            }
          }
        } catch (error) {
          console.error('❌ Error uploading files:', error);
        } finally {
          setIsUploading(false);
        }
      }
      
      // Navigate to the complaint page
      console.log(`🔄 Navigating to /complaints/${data.id}`);
      router.push(`/complaints/${data.id}`);
    },
    onError: (error) => {
      console.error('❌ Failed to create complaint:', error);
      alert(`Failed to create complaint: ${error.message}`);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles([...files, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    console.log('🚀 handleSubmit called');
    console.log('Form data:', formData);
    console.log('Files:', files.map(f => f.name));
    
    createComplaint.mutate({
      organizationId,
      createdBy: userId,
      clientReference: formData.clientReference,
      hmrcDepartment: 'To be determined',
      complaintType: 'To be determined',
      context: formData.complaintContext,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">New Complaint</h1>
        <div className="text-sm text-muted-foreground">
          Step {step} of 2
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Documents & Provide Context</CardTitle>
            <CardDescription>
              Our AI will analyze your documents against HMRC Charter commitments and precedent cases to identify potential complaint grounds automatically
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Client Reference */}
            <div>
              <label className="text-sm font-medium">Client Reference *</label>
              <Input
                placeholder="CLIENT-001 or Anonymous Case"
                value={formData.clientReference}
                onChange={(e) =>
                  setFormData({ ...formData, clientReference: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Anonymized identifier only (e.g., CLIENT-001, Case-ABC, or "Anonymous")
              </p>
            </div>

            {/* Context - The most important field */}
            <div>
              <label className="text-sm font-medium">What's the situation? *</label>
              <textarea
                className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Tell us what's happened in your own words:

• What is the issue with HMRC?
• What has happened so far?
• How has this impacted the client?
• What would the client like to achieve?

Don't worry about identifying specific Charter violations or complaint types - our AI will analyze your documents and context to identify these automatically."
                value={formData.complaintContext}
                onChange={(e) =>
                  setFormData({ ...formData, complaintContext: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                💡 Tip: Be as detailed as possible. This context helps our AI identify relevant Charter commitments and similar precedent cases.
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                What happens next?
              </h3>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Upload all relevant HMRC correspondence (letters, emails, etc.)</li>
                <li>Our AI analyzes the documents against HMRC Charter commitments</li>
                <li>We identify complaint grounds and match similar precedent cases</li>
                <li>We extract key dates, departments, and financial impacts automatically</li>
                <li>You review and refine the AI's analysis before submitting</li>
              </ol>
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!formData.clientReference || !formData.complaintContext}
              className="w-full"
            >
              Continue to Document Upload
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setStep(1)}>
            ← Back
          </Button>
          
          <Card>
            <CardHeader>
              <CardTitle>Upload All Correspondence & Evidence</CardTitle>
              <CardDescription>
                Upload all HMRC letters, emails, and evidence. Our AI will analyze them to identify Charter violations, extract key dates, and match precedent cases.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Upload Area */}
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm font-medium">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, Word, Excel, Text, Images (PNG, JPG, etc.) • Multiple files • Max 10MB per file
                  </p>
                </label>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Uploaded Files ({files.length})</p>
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="font-medium text-sm mb-2">📄 Best Practice:</p>
                <ul className="space-y-1 text-xs text-muted-foreground ml-4 list-disc">
                  <li>Upload ALL correspondence chronologically (even if you have 50+ documents)</li>
                  <li>Include chase emails/letters showing lack of response</li>
                  <li>Include any acknowledgement or reference numbers from HMRC</li>
                  <li>Include evidence of financial impact (statements, penalty notices, etc.)</li>
                  <li>The more context you provide, the better our AI can assess the case</li>
                </ul>
              </div>

              <Button 
                onClick={handleSubmit} 
                className="w-full"
                disabled={files.length === 0 || createComplaint.isPending || isUploading}
              >
                {isUploading ? 'Uploading Documents...' : createComplaint.isPending ? 'Creating Complaint...' : 'Create Complaint & Analyze Documents'}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                All documents are automatically anonymized before AI processing
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

