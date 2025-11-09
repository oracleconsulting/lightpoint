import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { processDocument } from '@/lib/documentProcessor';

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Document upload request received');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const complaintId = formData.get('complaintId') as string;
    const documentType = formData.get('documentType') as string || 'evidence';

    console.log(`📄 File: ${file?.name}, Size: ${file?.size}, Complaint: ${complaintId}`);

    if (!file || !complaintId) {
      console.error('❌ Missing required fields:', { file: !!file, complaintId: !!complaintId });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    console.log('🔄 Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`✅ Buffer created: ${buffer.length} bytes`);

    // Upload to Supabase Storage
    const fileName = `${complaintId}/${documentType}/${Date.now()}_${file.name}`;
    console.log(`📤 Uploading to Supabase: ${fileName}`);
    
    const { data: uploadData, error: uploadError } = await (supabaseAdmin as any).storage
      .from('complaint-documents')
      .upload(fileName, buffer, {
        contentType: file.type,
      });

    if (uploadError) {
      console.error('❌ Supabase upload error:', JSON.stringify(uploadError, null, 2));
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError.message },
        { status: 500 }
      );
    }

    console.log(`✅ File uploaded successfully: ${(uploadData as any).path}`);

    // Process document
    console.log('🔄 Processing document (extracting text, generating embeddings)...');
    const document = await processDocument(
      buffer,
      complaintId,
      documentType as any,
      (uploadData as any).path
    );

    console.log(`✅ Document processed: ${document.id}`);
    return NextResponse.json({ success: true, document });
  } catch (error: any) {
    console.error('❌ Document upload error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

