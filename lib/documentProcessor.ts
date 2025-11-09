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
    // 1. Extract text from PDF
    const pdfData = await pdfParse(fileBuffer);
    const rawText = pdfData.text;
    
    // 2. Anonymize PII
    const anonymizedText = anonymizePII(rawText);
    
    // 3. Extract structured data
    const extractedData = extractStructuredData(anonymizedText);
    
    // 4. Generate embedding for similarity search
    const embedding = await generateEmbedding(anonymizedText);
    
    // 5. Store in Supabase
    const { data: document, error} = await (supabaseAdmin as any)
      .from('documents')
      .insert({
        complaint_id: complaintId,
        document_type: documentType,
        file_path: filePath,
        processed_data: extractedData,
        vector_id: null, // Could store embedding separately if needed
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return document;
  } catch (error) {
    console.error('Document processing error:', error);
    throw new Error('Failed to process document');
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

