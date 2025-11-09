import { supabaseAdmin } from '@/lib/supabase/client';
import { anonymizePII, extractStructuredData } from '@/lib/privacy';
import { generateEmbedding } from '@/lib/embeddings';
// @ts-ignore - pdf-parse doesn't have proper types
import pdfParse from 'pdf-parse';

export interface ProcessedDocument {
  id: string;
  complaint_id: string;
  document_type: string;
  processed_data: any;
  vector_id?: string;
}

/**
 * Process uploaded document (PDF)
 */
export const processDocument = async (
  fileBuffer: Buffer,
  complaintId: string,
  documentType: 'hmrc_letter' | 'complaint_draft' | 'response' | 'evidence' | 'final_outcome',
  filePath: string
): Promise<ProcessedDocument> => {
  try {
    console.log('📄 Processing document:', { complaintId, documentType, filePath, size: fileBuffer.length });
    
    // 1. Extract text from PDF (skip text extraction for non-PDFs for now)
    let rawText = '';
    try {
      console.log('🔄 Attempting PDF text extraction...');
      const pdfData = await pdfParse(fileBuffer);
      rawText = pdfData.text;
      console.log(`✅ Extracted ${rawText.length} characters from PDF`);
    } catch (pdfError: any) {
      console.warn('⚠️ PDF parsing failed (might be DOCX or other format):', pdfError.message);
      // For non-PDF files (DOCX, etc.), we'll store with minimal processing for now
      rawText = '[Document text extraction pending - DOCX/other format]';
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
    if (rawText.length > 50 && !rawText.includes('[Document text extraction pending')) {
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
        document_type: documentType,
        file_path: filePath,
        processed_data: extractedData,
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

