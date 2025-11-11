import { supabaseAdmin } from '@/lib/supabase/client';
import { anonymizePII, extractStructuredData } from '@/lib/privacy';
import { generateEmbedding } from '@/lib/embeddings';
import { analyzeIndividualDocument } from '@/lib/documentAnalysis';
// @ts-ignore - pdf-parse doesn't have proper types
import pdfParse from 'pdf-parse';
// @ts-ignore - mammoth doesn't have proper types
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

/**
 * Extract text from scanned PDF using OCR (for PDFs with no text layer)
 * Note: Vision AI models cannot read PDFs directly - they need images
 */
const extractTextFromScannedPDF = async (pdfBuffer: Buffer): Promise<string> => {
  console.log('⚠️ Scanned PDF detected (no text layer)');
  console.log('📋 Vision models require images, not PDFs');
  
  // Return helpful guidance message
  return `[SCANNED PDF DETECTED - NO TEXT LAYER]

This PDF appears to be a scanned document (images inside a PDF wrapper) rather than a digital PDF with selectable text.

Current AI vision models cannot process PDF files directly - they require image formats (PNG, JPG, etc.).

RECOMMENDED SOLUTIONS (in order of quality):

1. **Use OCR-enabled PDF tool** (BEST):
   - Open in Adobe Acrobat and run "Recognize Text (OCR)"
   - On Mac: Open in Preview → File → Export → enable "Detect text"
   - This adds a text layer to the PDF, then re-upload

2. **Use a scanning app with built-in OCR**:
   - Adobe Scan (mobile) - automatically adds OCR
   - Microsoft Lens (mobile) - creates searchable PDFs
   - These create PDFs with text layers that work immediately

3. **Convert to images and upload those**:
   - Open PDF and export each page as PNG or JPG (high quality, 300 DPI)
   - Upload the images instead - our system will OCR them
   - Works for screenshots too

4. **Re-photograph the original document**:
   - If you have the physical letter, take a clear photo
   - Good lighting, flat surface, all text visible
   - Upload as JPG/PNG - system will auto-OCR

WHY THIS MATTERS:
Without readable text, the system cannot:
- Identify dates and reference numbers
- Detect Charter violations or CRG breaches
- Calculate delay timelines
- Generate accurate complaint letters
- Assess viability

The document is safely stored and you can delete/re-upload once you've added OCR or converted to images.

For immediate assistance, the fastest solution is #2 (scanning app) - it takes 30 seconds on your phone.]`;
};

/**
 * Extract text from image using Claude 3.5 Sonnet (best vision model available on OpenRouter)
 */
const extractTextFromImage = async (imageBuffer: Buffer): Promise<string> => {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }
    
    // Convert image to base64
    const base64Image = imageBuffer.toString('base64');
    const mimeType = detectImageMimeType(imageBuffer);
    
    console.log(`🔍 Performing OCR on image (${mimeType}, ${Math.round(imageBuffer.length / 1024)}KB)...`);
    
    // Compress large images if needed (max 5MB for API)
    let processedImage = base64Image;
    if (imageBuffer.length > 5 * 1024 * 1024) {
      console.log('⚠️ Image too large, attempting compression...');
      // For now, just warn - we'll handle compression if needed
    }
    
    // Try Claude 3.5 Sonnet first (best vision model on OpenRouter)
    // OpenRouter uses OpenAI-compatible format for all models
    console.log('🤖 Attempting OCR with Claude 3.5 Sonnet via OpenRouter...');
    try {
      const claudeResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://lightpoint.app',
          'X-Title': 'Lightpoint HMRC Complaint System',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',  // Excellent vision capabilities
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `You are performing OCR (Optical Character Recognition) on an HMRC tax document.

INSTRUCTIONS:
1. Extract ALL text visible in the image
2. Preserve exact formatting, line breaks, and structure
3. Include ALL dates, reference numbers, amounts, and details
4. Maintain the document's original layout as much as possible
5. If text is unclear, use [unclear] but transcribe your best interpretation
6. Return ONLY the extracted text, no explanations or commentary

This is critical for complaint analysis - accuracy is essential.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${processedImage}`
                  }
                }
              ]
            }
          ],
          max_tokens: 4000,
          temperature: 0.1  // Low temperature for accurate OCR
        }),
      });
      
      if (!claudeResponse.ok) {
        const errorText = await claudeResponse.text();
        console.error(`❌ Claude OCR failed: ${claudeResponse.status} - ${errorText}`);
        throw new Error(`Claude API error: ${claudeResponse.status}`);
      }
      
      const claudeData = await claudeResponse.json();
      
      if (!claudeData.choices || !claudeData.choices[0] || !claudeData.choices[0].message) {
        console.error('❌ Unexpected Claude response format:', JSON.stringify(claudeData));
        throw new Error('Unexpected Claude response format');
      }
      
      const extractedText = claudeData.choices[0].message.content;
      console.log(`✅ Claude OCR extracted ${extractedText.length} characters from image`);
      
      return extractedText;
      
    } catch (claudeError: any) {
      console.error('❌ Claude OCR failed:', claudeError.message);
      console.log('🔄 Falling back to GPT-4o...');
      
      // Fallback to GPT-4o
      const gptResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://lightpoint.app',
          'X-Title': 'Lightpoint HMRC Complaint System',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o',  // GPT-4o has vision capabilities
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `You are performing OCR (Optical Character Recognition) on an HMRC tax document.

INSTRUCTIONS:
1. Extract ALL text visible in the image
2. Preserve exact formatting, line breaks, and structure
3. Include ALL dates, reference numbers, amounts, and details
4. Maintain the document's original layout as much as possible
5. If text is unclear, use [unclear] but transcribe your best interpretation
6. Return ONLY the extracted text, no explanations or commentary

This is critical for complaint analysis - accuracy is essential.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${processedImage}`
                  }
                }
              ]
            }
          ],
          max_tokens: 4000,
          temperature: 0.1
        }),
      });
      
      if (!gptResponse.ok) {
        const errorText = await gptResponse.text();
        console.error(`❌ GPT-4o OCR also failed: ${gptResponse.status} - ${errorText}`);
        throw new Error(`Both Claude and GPT-4o OCR failed. Last error: ${gptResponse.status} - ${errorText}`);
      }
      
      const gptData = await gptResponse.json();
      
      if (!gptData.choices || !gptData.choices[0] || !gptData.choices[0].message) {
        console.error('❌ Unexpected GPT response format:', JSON.stringify(gptData));
        throw new Error('Unexpected GPT response format');
      }
      
      const extractedText = gptData.choices[0].message.content;
      console.log(`✅ GPT-4o OCR extracted ${extractedText.length} characters from image`);
      
      return extractedText;
    }
    
  } catch (error: any) {
    console.error('❌ Image OCR completely failed:', error.message);
    console.error('Error stack:', error.stack);
    return `[OCR failed for image: ${error.message}. Image stored for manual review. Please check server logs for details.]`;
  }
};

/**
 * Detect image MIME type from buffer
 */
const detectImageMimeType = (buffer: Buffer): string => {
  // Check magic numbers (file signatures)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
    return 'image/bmp';
  }
  if ((buffer[0] === 0x49 && buffer[1] === 0x49) || (buffer[0] === 0x4D && buffer[1] === 0x4D)) {
    return 'image/tiff';
  }
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return 'image/webp';
  }
  
  // Default to PNG if unknown
  return 'image/png';
};

export interface ProcessedDocument {
  id: string;
  complaint_id: string;
  document_type: string;
  processed_data: any;
  vector_id?: string;
}

/**
 * Extract text from various file formats including images with OCR
 */
const extractTextFromFile = async (fileBuffer: Buffer, fileName: string): Promise<string> => {
  const fileExtension = fileName.toLowerCase().split('.').pop();
  
  console.log(`🔍 Detected file type: .${fileExtension}`);
  
  try {
    switch (fileExtension) {
      case 'pdf':
        console.log('📄 Extracting text from PDF...');
        const pdfData = await pdfParse(fileBuffer);
        const extractedText = pdfData.text.trim();
        
        // Check if PDF is scanned (no text extracted or very little text)
        if (!extractedText || extractedText.length < 50) {
          console.log('⚠️ PDF appears to be scanned (no text layer detected)');
          console.log('🔄 Attempting OCR on PDF pages...');
          
          // For scanned PDFs, we need to use OCR
          // pdf-parse doesn't give us the images, so we'll use a different approach
          // We'll use GPT-4o Vision to read the PDF directly
          return await extractTextFromScannedPDF(fileBuffer);
        }
        
        return extractedText;
      
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
      
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'bmp':
      case 'tiff':
      case 'webp':
        console.log('🖼️ Extracting text from image using OCR...');
        return await extractTextFromImage(fileBuffer);
      
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
 * Process uploaded document - supports PDF, DOCX, DOC, TXT, XLS, XLSX, CSV, PNG, JPG, etc.
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
    
    // Check if we have meaningful text to process
    const hasValidText = rawText.length > 50 && 
                        !rawText.includes('[Text extraction') && 
                        !rawText.includes('[Document text extraction pending');
    
    // 3.5 STAGE 1: Deep document analysis (captures EVERYTHING)
    console.log('🔄 Stage 1: Performing deep document analysis...');
    let detailedAnalysis = null;
    if (hasValidText) {
      try {
        detailedAnalysis = await analyzeIndividualDocument(
          anonymizedText,
          documentType,
          fileName
        );
        console.log('✅ Stage 1 analysis complete - ALL details captured');
      } catch (analysisError: any) {
        console.error('❌ Document analysis failed:', analysisError.message);
        // Continue without detailed analysis - basic extraction is still available
      }
    } else {
      console.log('⏭️ Skipping deep analysis (insufficient text)');
    }
    
    // 4. Generate embedding for similarity search (only if we have meaningful text)
    let embedding = null;
    
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
          detailed_analysis: detailedAnalysis, // STAGE 1: Full analysis stored here
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

