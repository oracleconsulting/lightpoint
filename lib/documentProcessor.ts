import { supabaseAdmin } from '@/lib/supabase/client';
import { anonymizePII, extractStructuredData } from '@/lib/privacy';
import { generateEmbedding } from '@/lib/embeddings';
// @ts-ignore - pdf-parse doesn't have proper types
import pdfParse from 'pdf-parse';
// @ts-ignore - mammoth doesn't have proper types
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export interface ProcessedDocument {
  id: string;
  complaint_id: string;
  document_type: string;
  processed_data: any;
  vector_id?: string;
}

/**
 * Extract text from various file formats
 */
const extractTextFromFile = async (fileBuffer: Buffer, fileName: string): Promise<string> => {
  const fileExtension = fileName.toLowerCase().split('.').pop();
  
  console.log(`🔍 Detected file type: .${fileExtension}`);
  
  try {
    switch (fileExtension) {
      case 'pdf':
        console.log('📄 Extracting text from PDF...');
        const pdfData = await pdfParse(fileBuffer);
        return pdfData.text;
      
      case 'doc':
      case 'docx':
        console.log('📝 Extracting text from DOCX...');
        const docResult = await mammoth.extractRawText({ buffer: fileBuffer });
        return docResult.value;
      
      case 'txt':
        console.log('📝 Reading text file...');
        return fileBuffer.toString('utf-8');
      
      case 'xls':
      case 'xlsx':
      case 'csv':
        console.log('📊 Extracting text from spreadsheet...');
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        let allText = '';
        
        // Extract text from all sheets
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const sheetText = XLSX.utils.sheet_to_txt(sheet, { blankrows: false });
          allText += `\n=== Sheet: ${sheetName} ===\n${sheetText}\n`;
        });
        
        return allText;
      
      default:
        console.warn(`⚠️ Unsupported file type: .${fileExtension}`);
        return `[Text extraction not supported for .${fileExtension} files - file stored for manual review]`;
    }
  } catch (error: any) {
    console.error(`❌ Text extraction failed for .${fileExtension}:`, error.message);
    throw new Error(`Failed to extract text from .${fileExtension} file: ${error.message}`);
  }
};

/**
 * Process uploaded document - supports PDF, DOCX, DOC, TXT, XLS, XLSX, CSV
 */
export const processDocument = async (
  fileBuffer: Buffer,
  complaintId: string,
  documentType: 'hmrc_letter' | 'complaint_draft' | 'response' | 'evidence' | 'final_outcome',
  filePath: string
): Promise<ProcessedDocument> => {
  try {
    const fileName = filePath.split('/').pop() || 'unknown';
    console.log('📄 Processing document:', { complaintId, documentType, fileName, size: fileBuffer.length });
    
    // 1. Extract text from file (supports multiple formats)
    let rawText = '';
    try {
      rawText = await extractTextFromFile(fileBuffer, fileName);
      console.log(`✅ Extracted ${rawText.length} characters from ${fileName}`);
    } catch (extractError: any) {
      console.error('❌ Text extraction failed:', extractError.message);
      // Store document anyway with placeholder text
      rawText = `[Text extraction failed for ${fileName}: ${extractError.message}]`;
    }
    
    // 2. Anonymize PII
    console.log('🔄 Anonymizing PII...');
    const anonymizedText = anonymizePII(rawText);
    console.log('✅ PII anonymized');
    
    // 3. Extract structured data
    console.log('🔄 Extracting structured data...');
    const extractedData = extractStructuredData(anonymizedText);
    console.log('✅ Structured data extracted:', extractedData);
    
    // 4. Generate embedding for similarity search (only if we have meaningful text)
    let embedding = null;
    const hasValidText = rawText.length > 50 && 
                        !rawText.includes('[Text extraction') && 
                        !rawText.includes('[Document text extraction pending');
    
    if (hasValidText) {
      try {
        console.log('🔄 Generating embedding...');
        embedding = await generateEmbedding(anonymizedText);
        console.log(`✅ Embedding generated: ${embedding.length} dimensions`);
      } catch (embError: any) {
        console.error('❌ Embedding generation failed:', embError.message);
        // Continue without embedding - we can regenerate later
      }
    } else {
      console.log('⏭️ Skipping embedding generation (insufficient text)');
    }
    
    // 5. Store in Supabase
    console.log('🔄 Inserting document record into database...');
    const { data: document, error} = await (supabaseAdmin as any)
      .from('documents')
      .insert({
        complaint_id: complaintId,
        filename: fileName, // Required: original filename
        file_path: filePath, // Required: storage path
        document_type: documentType,
        processed_data: {
          ...extractedData,
          raw_text_length: rawText.length,
          file_name: fileName,
          has_embedding: !!embedding,
        },
        embedding: embedding, // Store the embedding vector directly
        vector_id: null,
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Database insert error:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    console.log(`✅ Document stored in database: ${document.id}`);
    return document;
  } catch (error: any) {
    console.error('❌ Document processing error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    throw new Error(`Failed to process document: ${error.message}`);
  }
};

/**
 * Upload file to Supabase Storage
 */
export const uploadDocument = async (
  file: File,
  complaintId: string,
  documentType: string
): Promise<string> => {
  try {
    const fileName = `${complaintId}/${documentType}/${Date.now()}_${file.name}`;
    
    const { data, error } = await (supabaseAdmin as any).storage
      .from('complaint-documents')
      .upload(fileName, file);
    
    if (error) throw error;
    
    return (data as any).path;
  } catch (error) {
    console.error('File upload error:', error);
    throw new Error('Failed to upload file');
  }
};

/**
 * Get document download URL
 */
export const getDocumentUrl = async (filePath: string): Promise<string> => {
  try {
    const { data } = await (supabaseAdmin as any).storage
      .from('complaint-documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry
    
    if (!data) throw new Error('Failed to generate URL');
    
    return (data as any).signedUrl;
  } catch (error) {
    console.error('Get document URL error:', error);
    throw new Error('Failed to get document URL');
  }
};

/**
 * Get all documents for a complaint
 */
export const getComplaintDocuments = async (complaintId: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('complaint_id', complaintId)
      .order('uploaded_at', { ascending: false });
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Get documents error:', error);
    throw new Error('Failed to retrieve documents');
  }
};

