'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Download, Maximize2, Minimize2, FileText, Image as ImageIcon } from 'lucide-react';

interface DocumentViewerProps {
  filename: string;
  fileType: string;
  storageUrl: string;
  onClose: () => void;
}

export function DocumentViewer({ filename, fileType, storageUrl, onClose }: DocumentViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isImage = fileType?.toLowerCase().includes('image') || 
                  ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff'].some(ext => 
                    filename.toLowerCase().endsWith(`.${ext}`)
                  );
  
  const isPDF = fileType?.toLowerCase().includes('pdf') || filename.toLowerCase().endsWith('.pdf');
  
  const isViewable = isImage || isPDF;

  return (
    <Card className={`mt-3 ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isImage ? (
              <ImageIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
            ) : (
              <FileText className="h-4 w-4 text-purple-500 flex-shrink-0" />
            )}
            <span className="text-sm font-medium truncate">{filename}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(storageUrl, '_blank')}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
            {isViewable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className={`${isFullscreen ? 'h-[calc(100vh-8rem)]' : 'h-[600px]'} overflow-auto bg-gray-50`}>
          {!isViewable ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileText className="h-16 w-16 mb-4" />
              <p className="text-sm mb-2">Preview not available for this file type</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(storageUrl, '_blank')}
              >
                <Download className="h-4 w-4 mr-2" />
                Download to view
              </Button>
            </div>
          ) : isImage ? (
            <div className="flex items-center justify-center h-full p-4">
              <img 
                src={storageUrl} 
                alt={filename}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : isPDF ? (
            <iframe
              src={`${storageUrl}#view=FitH`}
              className="w-full h-full border-0"
              title={filename}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

