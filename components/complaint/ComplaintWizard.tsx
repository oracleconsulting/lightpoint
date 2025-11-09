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
    hmrcDepartment: '',
    complaintType: '',
    complaintContext: '',
    keyDates: '',
    financialImpact: '',
    clientObjective: '',
  });

  const createComplaint = trpc.complaints.create.useMutation({
    onSuccess: (data: any) => {
      router.push(`/complaints/${data.id}`);
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
    createComplaint.mutate({
      organizationId,
      createdBy: userId,
      clientReference: formData.clientReference,
      hmrcDepartment: formData.hmrcDepartment,
      complaintType: formData.complaintType,
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
            <CardTitle>Complaint Details</CardTitle>
            <CardDescription>
              Provide context to help assess the complaint basis and identify applicable precedents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Client Reference *</label>
                <Input
                  placeholder="CLIENT-001"
                  value={formData.clientReference}
                  onChange={(e) =>
                    setFormData({ ...formData, clientReference: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Anonymized identifier only
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">HMRC Department *</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.hmrcDepartment}
                  onChange={(e) =>
                    setFormData({ ...formData, hmrcDepartment: e.target.value })
                  }
                >
                  <option value="">Select department</option>
                  <option value="VAT">VAT</option>
                  <option value="Self Assessment">Self Assessment</option>
                  <option value="PAYE">PAYE</option>
                  <option value="Corporation Tax">Corporation Tax</option>
                  <option value="CIS">CIS</option>
                  <option value="Compliance">Compliance</option>
                  <option value="Debt Management">Debt Management</option>
                  <option value="Tax Credits">Tax Credits</option>
                </select>
              </div>
            </div>

            {/* Complaint Type */}
            <div>
              <label className="text-sm font-medium">Complaint Type *</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.complaintType}
                onChange={(e) =>
                  setFormData({ ...formData, complaintType: e.target.value })
                }
              >
                <option value="">Select type</option>
                <option value="Unreasonable delay">Unreasonable delay</option>
                <option value="Poor communication">Poor communication</option>
                <option value="Incorrect advice">Incorrect advice</option>
                <option value="Penalty error">Penalty error</option>
                <option value="Lost correspondence">Lost correspondence</option>
                <option value="Failure to respond">Failure to respond</option>
                <option value="Discourteous behaviour">Discourteous behaviour</option>
                <option value="System error">System error</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Context - Large Text Area */}
            <div>
              <label className="text-sm font-medium">Complaint Context *</label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Provide detailed context about the issue:
- What happened?
- When did it start?
- What actions have been taken so far?
- Why is this problematic for the client?
- What Charter commitments may have been breached?"
                value={formData.complaintContext}
                onChange={(e) =>
                  setFormData({ ...formData, complaintContext: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                This context helps identify Charter violations and similar precedents
              </p>
            </div>

            {/* Key Dates */}
            <div>
              <label className="text-sm font-medium">Key Dates & Timeline</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g.,
- 15 Jan 2024: VAT return submitted
- 10 Feb 2024: Repayment requested
- 15 Mar 2024: Chased - no response
- 20 Apr 2024: Still no repayment (8 weeks overdue)"
                value={formData.keyDates}
                onChange={(e) =>
                  setFormData({ ...formData, keyDates: e.target.value })
                }
              />
            </div>

            {/* Financial Impact */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Financial Impact</label>
                <Input
                  placeholder="e.g., £15,000 repayment outstanding"
                  value={formData.financialImpact}
                  onChange={(e) =>
                    setFormData({ ...formData, financialImpact: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Cash flow impact, penalties, interest, etc.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Client Objective</label>
                <Input
                  placeholder="e.g., Repayment + compensation"
                  value={formData.clientObjective}
                  onChange={(e) =>
                    setFormData({ ...formData, clientObjective: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  What does the client want to achieve?
                </p>
              </div>
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!formData.clientReference || !formData.hmrcDepartment || !formData.complaintType || !formData.complaintContext}
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
              <CardTitle>Upload Supporting Documents</CardTitle>
              <CardDescription>
                Upload all relevant HMRC correspondence, evidence, and supporting documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Upload Area */}
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm font-medium">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, DOC, DOCX (Max 10MB per file)
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

              <div className="bg-muted p-4 rounded-lg text-sm">
                <p className="font-medium mb-2">💡 Tip: Upload documents that show:</p>
                <ul className="space-y-1 text-muted-foreground ml-4 list-disc">
                  <li>Original HMRC letters and correspondence</li>
                  <li>Evidence of delays (submission dates, chase emails)</li>
                  <li>Previous attempts to resolve the issue</li>
                  <li>Financial impact documentation</li>
                  <li>Any relevant supporting evidence</li>
                </ul>
              </div>

              <Button 
                onClick={handleSubmit} 
                className="w-full"
                disabled={files.length === 0}
              >
                Create Complaint & Upload Documents
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

