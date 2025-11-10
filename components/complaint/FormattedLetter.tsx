'use client';

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Copy, Download, Check } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

interface FormattedLetterProps {
  content: string;
  clientReference: string;
}

/**
 * Parse markdown-style formatting to HTML
 */
const parseMarkdownToHtml = (text: string): string => {
  let html = text;
  
  // Bold: **text** → <strong>text</strong>
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Italic: *text* → <em>text</em> (but not if part of **)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  
  // Line breaks
  html = html.replace(/\n/g, '<br />');
  
  return html;
};

/**
 * Parse markdown for Word document generation
 */
const parseMarkdownForDocx = (text: string): Array<{ text: string; bold?: boolean; italic?: boolean }> => {
  const result: Array<{ text: string; bold?: boolean; italic?: boolean }> = [];
  let remaining = text;
  
  // Regex to match **bold**, *italic*, or plain text
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|([^\*]+)/g;
  let match;
  
  while ((match = regex.exec(remaining)) !== null) {
    if (match[2]) {
      // Bold text
      result.push({ text: match[2], bold: true });
    } else if (match[4]) {
      // Italic text
      result.push({ text: match[4], italic: true });
    } else if (match[5]) {
      // Plain text
      result.push({ text: match[5] });
    }
  }
  
  return result;
};

export function FormattedLetter({ content, clientReference }: FormattedLetterProps) {
  const [copied, setCopied] = React.useState(false);
  const letterRef = useRef<HTMLDivElement>(null);

  const handleCopy = async () => {
    try {
      // Copy as HTML to preserve formatting
      const htmlContent = parseMarkdownToHtml(content);
      
      // Create a temporary div
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      tempDiv.style.fontFamily = 'Georgia, serif';
      tempDiv.style.fontSize = '12pt';
      tempDiv.style.lineHeight = '1.6';
      tempDiv.style.color = '#000';
      document.body.appendChild(tempDiv);

      // Select and copy
      const range = document.createRange();
      range.selectNodeContents(tempDiv);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      document.execCommand('copy');
      
      // Cleanup
      selection?.removeAllRanges();
      document.body.removeChild(tempDiv);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      // Fallback to plain text
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportWord = async () => {
    try {
      const lines = content.split('\n');
      const paragraphs: Paragraph[] = [];

      lines.forEach((line) => {
        if (line.trim() === '') {
          // Empty line - spacing
          paragraphs.push(new Paragraph({ text: '' }));
        } else {
          // Parse the line for formatting
          const segments = parseMarkdownForDocx(line);
          const textRuns = segments.map(
            (seg) =>
              new TextRun({
                text: seg.text,
                bold: seg.bold || false,
                italics: seg.italic || false,
                font: 'Calibri',
                size: 24, // 12pt
              })
          );

          // Check if this is a heading (e.g., starts with **)
          const isHeading = line.startsWith('**') && line.endsWith('**');

          paragraphs.push(
            new Paragraph({
              children: textRuns,
              spacing: { after: 200, before: 100 },
              ...(isHeading && {
                heading: HeadingLevel.HEADING_2,
                alignment: AlignmentType.LEFT,
              }),
            })
          );
        }
      });

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: paragraphs,
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `HMRC_Complaint_${clientReference}_${new Date().toISOString().split('T')[0]}.docx`);
    } catch (error) {
      console.error('Failed to export Word document:', error);
      alert('Failed to export Word document. Please try copying instead.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleCopy}
          variant="outline"
          className="flex-1"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Copy Letter
            </>
          )}
        </Button>
        <Button
          onClick={handleExportWord}
          variant="outline"
          className="flex-1"
        >
          <Download className="w-4 h-4 mr-2" />
          Export to Word
        </Button>
      </div>

      {/* Formatted Letter Display */}
      <Card className="p-8 bg-white" ref={letterRef}>
        <div
          className="prose prose-sm max-w-none"
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '12pt',
            lineHeight: '1.6',
            color: '#000',
          }}
          dangerouslySetInnerHTML={{
            __html: parseMarkdownToHtml(content),
          }}
        />
      </Card>

      <div className="text-sm text-muted-foreground">
        <p>
          <strong>Tip:</strong> Use "Copy Letter" to paste into Word/Google Docs on your headed paper, or "Export to Word" for a pre-formatted document.
        </p>
      </div>
    </div>
  );
}

