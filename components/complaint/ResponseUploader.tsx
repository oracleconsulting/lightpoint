'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Mail, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc/Provider';

interface ResponseUploaderProps {
  complaintId: string;
  onResponseUploaded?: () => void;
}

export function ResponseUploader({ complaintId, onResponseUploaded }: ResponseUploaderProps) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [context, setContext] = useState('');
  const [uploading, setUploading] = useState(false);

  const utils = trpc.useUtils();

  const handleUpload = async () => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('complaintId', complaintId);
      formData.append('documentType', 'response');
      formData.append('context', context);

      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      // Refresh documents list
      utils.documents.list.invalidate(complaintId);
      utils.complaints.getById.invalidate(complaintId);

      // Reset form
      setFiles(null);
      setContext('');
      onResponseUploaded?.();

      alert('HMRC response uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload response');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Upload HMRC Response
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Response Received?</p>
              <p>Upload HMRC's response letter or correspondence. The system will analyze it and help you prepare a follow-up if needed.</p>
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Response Document(s)
          </label>
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            onChange={(e) => setFiles(e.target.files)}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-primary file:text-primary-foreground
              hover:file:bg-primary/90
              cursor-pointer"
          />
          {files && (
            <p className="mt-2 text-xs text-muted-foreground">
              {files.length} file(s) selected
            </p>
          )}
        </div>

        {/* Context */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Additional Context (Optional)
          </label>
          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Any additional information about this response (e.g., received date, reference numbers, key points...)"
            rows={3}
          />
        </div>

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={!files || files.length === 0 || uploading}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? 'Uploading...' : 'Upload Response'}
        </Button>
      </CardContent>
    </Card>
  );
}

