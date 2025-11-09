/**
 * Automated Knowledge Document Processor
 * 
 * This script processes all documents in the knowledge-uploads folder,
 * extracts text, generates embeddings, and uploads to Supabase.
 * 
 * Supported formats: PDF, DOCX, TXT, MD
 * 
 * Folder structure:
 * knowledge-uploads/
 *   ├── charter/           → HMRC Charter documents
 *   ├── crg-guidance/      → Complaint Resolution Guidance
 *   ├── precedents/        → Past case examples (sanitized)
 *   ├── service-standards/ → HMRC service timeframes
 *   └── prompts/           → LLM system prompts
 * 
 * Usage:
 * 1. Place your documents in the appropriate folders
 * 2. Run: npx tsx scripts/process-knowledge-uploads.ts
 * 3. Documents are automatically categorized and uploaded
 */

import fs from 'fs';
import path from 'path';
// @ts-ignore
import pdfParse from 'pdf-parse';
import { addToKnowledgeBase } from '../lib/vectorSearch';

const UPLOADS_DIR = path.join(process.cwd(), 'knowledge-uploads');

// Category mapping based on folder
const CATEGORY_MAP: Record<string, string> = {
  'charter': 'HMRC Charter',
  'crg-guidance': 'CRG',
  'precedents': 'Precedents',
  'service-standards': 'Service Standards',
  'prompts': 'LLM Prompts'
};

interface ProcessedDocument {
  title: string;
  content: string;
  category: string;
  source: string;
  filePath: string;
}

/**
 * Extract text from PDF file
 */
async function extractPDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`Error extracting PDF ${filePath}:`, error);
    throw error;
  }
}

/**
 * Extract text from text file (TXT, MD)
 */
function extractText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Extract text from DOCX file
 * Note: For DOCX, you'll need to install 'mammoth': npm install mammoth
 * For now, we'll ask users to convert DOCX to PDF or TXT
 */
async function extractDOCX(filePath: string): Promise<string> {
  try {
    // Uncomment if you install mammoth:
    // const mammoth = require('mammoth');
    // const result = await mammoth.extractRawText({ path: filePath });
    // return result.value;
    
    throw new Error('DOCX support requires mammoth package. Please convert to PDF or TXT, or install: npm install mammoth');
  } catch (error) {
    console.error(`Error extracting DOCX ${filePath}:`, error);
    throw error;
  }
}

/**
 * Process a single document file
 */
async function processDocument(filePath: string, category: string): Promise<ProcessedDocument> {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath, ext);
  
  console.log(`📄 Processing: ${fileName}${ext}`);
  
  let content: string;
  
  // Extract text based on file type
  switch (ext) {
    case '.pdf':
      content = await extractPDF(filePath);
      break;
    case '.txt':
    case '.md':
      content = extractText(filePath);
      break;
    case '.docx':
      content = await extractDOCX(filePath);
      break;
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
  
  // Clean up the content
  content = content.trim();
  
  if (!content || content.length < 50) {
    throw new Error(`Content too short or empty (${content.length} chars)`);
  }
  
  return {
    title: fileName.replace(/_/g, ' ').replace(/-/g, ' '),
    content,
    category: CATEGORY_MAP[category] || category,
    source: fileName,
    filePath
  };
}

/**
 * Process all documents in a folder
 */
async function processFolder(folderName: string): Promise<ProcessedDocument[]> {
  const folderPath = path.join(UPLOADS_DIR, folderName);
  
  if (!fs.existsSync(folderPath)) {
    console.log(`⚠️  Folder not found: ${folderName}`);
    return [];
  }
  
  const files = fs.readdirSync(folderPath).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.pdf', '.txt', '.md', '.docx'].includes(ext);
  });
  
  if (files.length === 0) {
    console.log(`📂 No documents in: ${folderName}`);
    return [];
  }
  
  console.log(`\n📂 Processing folder: ${folderName} (${files.length} files)`);
  
  const processed: ProcessedDocument[] = [];
  
  for (const file of files) {
    try {
      const filePath = path.join(folderPath, file);
      const doc = await processDocument(filePath, folderName);
      processed.push(doc);
      console.log(`   ✅ Extracted ${doc.content.length} chars from ${file}`);
    } catch (error) {
      console.error(`   ❌ Failed to process ${file}:`, error);
    }
  }
  
  return processed;
}

/**
 * Upload documents to Supabase
 */
async function uploadToSupabase(documents: ProcessedDocument[]) {
  console.log(`\n🚀 Uploading ${documents.length} documents to Supabase...`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const doc of documents) {
    try {
      await addToKnowledgeBase(
        doc.category,
        doc.title,
        doc.content,
        doc.source
      );
      console.log(`   ✅ Uploaded: ${doc.title}`);
      successCount++;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`   ❌ Failed to upload ${doc.title}:`, error);
      errorCount++;
    }
  }
  
  return { successCount, errorCount };
}

/**
 * Main processing function
 */
async function processAllKnowledge() {
  console.log('🌟 Lightpoint Knowledge Document Processor');
  console.log('='.repeat(50));
  console.log(`📁 Upload directory: ${UPLOADS_DIR}\n`);
  
  // Check if upload directory exists
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.error('❌ knowledge-uploads directory not found!');
    console.log('\nPlease create it with:');
    console.log('  mkdir -p knowledge-uploads/{charter,crg-guidance,precedents,service-standards,prompts}');
    process.exit(1);
  }
  
  // Process all folders
  const folders = Object.keys(CATEGORY_MAP);
  let allDocuments: ProcessedDocument[] = [];
  
  for (const folder of folders) {
    const docs = await processFolder(folder);
    allDocuments = allDocuments.concat(docs);
  }
  
  if (allDocuments.length === 0) {
    console.log('\n⚠️  No documents found to process!');
    console.log('\nPlace your documents in:');
    folders.forEach(f => console.log(`  - knowledge-uploads/${f}/`));
    console.log('\nSupported formats: PDF, TXT, MD');
    process.exit(0);
  }
  
  console.log(`\n📊 Extracted ${allDocuments.length} documents:`);
  for (const [category, count] of Object.entries(
    allDocuments.reduce((acc, doc) => {
      acc[doc.category] = (acc[doc.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  )) {
    console.log(`   - ${category}: ${count}`);
  }
  
  // Upload to Supabase
  const { successCount, errorCount } = await uploadToSupabase(allDocuments);
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('✨ Processing Complete!');
  console.log('='.repeat(50));
  console.log(`✅ Successfully uploaded: ${successCount} documents`);
  console.log(`❌ Failed: ${errorCount} documents`);
  
  if (successCount > 0) {
    console.log('\n🎉 Your knowledge base is ready!');
    console.log('   You can now use the search feature to find relevant guidance.');
  }
}

// Run if called directly
if (require.main === module) {
  processAllKnowledge()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Processing failed:', error);
      process.exit(1);
    });
}

export { processAllKnowledge };
