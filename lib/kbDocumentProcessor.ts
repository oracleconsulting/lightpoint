/**
 * Knowledge Base Document Upload Processor
 * 
 * Handles document upload, text extraction, and preparation for AI comparison
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ProcessedDocument {
  filename: string;
  fileType: string;
  fileSize: number;
  extractedText: string;
  documentChunks: string[];
  storagePath: string;
}

/**
 * Extract text from various file types
 */
async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.name.split('.').pop()?.toLowerCase();
  
  if (fileType === 'pdf') {
    // Use pdf-parse for PDFs
    const arrayBuffer = await file.arrayBuffer();
    const pdfParse = (await import('pdf-parse/lib/pdf-parse' as any)).default;
    const data = await pdfParse(Buffer.from(arrayBuffer));
    return data.text;
  } else if (fileType === 'txt') {
    // Plain text
    return await file.text();
  } else if (fileType === 'docx' || fileType === 'doc') {
    // Use mammoth for Word documents
    const arrayBuffer = await file.arrayBuffer();
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } else if (fileType === 'xlsx' || fileType === 'xls' || fileType === 'csv') {
    // Use xlsx for Excel/CSV
    const arrayBuffer = await file.arrayBuffer();
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    let text = '';
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      text += XLSX.utils.sheet_to_txt(sheet) + '\n\n';
    });
    return text;
  } else {
    throw new Error(`Unsupported file type: ${fileType}`);
  }
}

/**
 * Chunk text into smaller pieces for better embedding and comparison
 */
function chunkText(text: string, chunkSize: number = 1000): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length < chunkSize) {
      currentChunk += paragraph + '\n\n';
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = paragraph + '\n\n';
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 50); // Filter out tiny chunks
}

/**
 * Upload file to Supabase storage
 */
async function uploadToStorage(file: File, orgId: string): Promise<string> {
  const timestamp = Date.now();
  const filename = `${timestamp}-${file.name}`;
  const storagePath = `knowledge-base/${orgId}/${filename}`;
  
  const { error } = await supabase.storage
    .from('documents')
    .upload(storagePath, file);
  
  if (error) throw error;
  
  return storagePath;
}

/**
 * Main function to process a document for KB upload
 */
export async function processDocumentForKB(
  file: File,
  orgId: string
): Promise<ProcessedDocument> {
  const startTime = Date.now();
  console.log(`📄 Processing ${file.name}...`);
  
  // 1. Upload to storage
  console.log(`  ⏳ Step 1/3: Uploading to storage...`);
  const storagePath = await uploadToStorage(file, orgId);
  console.log(`  ✅ Step 1/3: Uploaded to storage (${Date.now() - startTime}ms)`);
  
  // 2. Extract text
  console.log(`  ⏳ Step 2/3: Extracting text from ${file.type || 'PDF'}...`);
  const extractStartTime = Date.now();
  const extractedText = await extractTextFromFile(file);
  console.log(`  ✅ Step 2/3: Extracted ${extractedText.length} characters (${Date.now() - extractStartTime}ms)`);
  
  if (extractedText.length < 100) {
    throw new Error('Document appears to be empty or text extraction failed');
  }
  
  // 3. Chunk text
  console.log(`  ⏳ Step 3/3: Chunking text...`);
  const documentChunks = chunkText(extractedText);
  console.log(`  ✅ Step 3/3: Created ${documentChunks.length} chunks (${Date.now() - startTime}ms total)`);
  
  return {
    filename: file.name,
    fileType: file.type || 'application/octet-stream',
    fileSize: file.size,
    extractedText,
    documentChunks,
    storagePath,
  };
}

/**
 * Process multiple documents in parallel
 */
export async function processMultipleDocuments(
  files: File[],
  orgId: string,
  onProgress?: (current: number, total: number, filename: string) => void
): Promise<ProcessedDocument[]> {
  const results: ProcessedDocument[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    if (onProgress) {
      onProgress(i + 1, files.length, file.name);
    }
    
    try {
      const processed = await processDocumentForKB(file, orgId);
      results.push(processed);
    } catch (error: any) {
      console.error(`❌ Failed to process ${file.name}:`, error);
      // Continue with other files
    }
  }
  
  return results;
}

