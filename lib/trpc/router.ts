import { router, publicProcedure } from './trpc';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/client';
import { processDocument } from '@/lib/documentProcessor';
import { analyzeComplaint, generateComplaintLetter, generateResponse } from '@/lib/openrouter/client';
import { generateComplaintLetterThreeStage } from '@/lib/openrouter/three-stage-client';
import { searchKnowledgeBase, searchKnowledgeBaseMultiAngle, searchPrecedents } from '@/lib/vectorSearch';
import { logTime } from '@/lib/timeTracking';
import { sanitizeForLLM } from '@/lib/privacy';
import { prepareAnalysisContext, estimateTokens } from '@/lib/contextManager';
import { generateEmbedding } from '@/lib/embeddings';

export const appRouter = router({
  // Complaints
  complaints: router({
    create: publicProcedure
      .input(z.object({
        organizationId: z.string(),
        createdBy: z.string(),
        clientReference: z.string(),
        complaintType: z.string().optional(),
        hmrcDepartment: z.string().optional(),
        context: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await (supabaseAdmin as any)
          .from('complaints')
          .insert({
            organization_id: input.organizationId,
            created_by: input.createdBy,
            complaint_reference: input.clientReference,
            complaint_type: input.complaintType,
            hmrc_department: input.hmrcDepartment,
            status: 'assessment',
            timeline: input.context ? [{
              date: new Date().toISOString(),
              type: 'context_provided',
              summary: input.context,
            }] : [],
          })
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        
        return data;
      }),

    list: publicProcedure
      .input(z.object({
        organizationId: z.string(),
        status: z.enum(['assessment', 'draft', 'active', 'escalated', 'resolved', 'closed']).optional(),
      }))
      .query(async ({ input }) => {
        try {
          console.log('📋 Fetching complaints for org:', input.organizationId);
          console.log('📋 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30));
          
          let query = supabaseAdmin
            .from('complaints')
            .select('*')
            .eq('organization_id', input.organizationId);
          
          if (input.status) {
            query = query.eq('status', input.status);
          }
          
          console.log('📋 Executing Supabase query...');
          const { data, error } = await query.order('created_at', { ascending: false });
          
          console.log('📋 Supabase response:', { 
            hasData: !!data, 
            dataCount: data?.length, 
            hasError: !!error,
            errorDetails: error ? {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
            } : null
          });
          
          if (error) {
            console.error('❌ Supabase error details:', JSON.stringify(error, null, 2));
            throw new Error(`Supabase error: ${error.message} (${error.code || 'no code'})`);
          }
          
          console.log('✅ Successfully fetched complaints:', data?.length || 0);
          return data;
        } catch (err: any) {
          console.error('❌ Complaints list error:', err);
          console.error('❌ Error stack:', err.stack);
          throw err;
        }
      }),

    getById: publicProcedure
      .input(z.string())
      .query(async ({ input }) => {
        const { data, error } = await supabaseAdmin
          .from('complaints')
          .select('*')
          .eq('id', input)
          .single();
        
        if (error) throw new Error(error.message);
        
        return data;
      }),

    updateStatus: publicProcedure
      .input(z.object({
        id: z.string(),
        status: z.enum(['assessment', 'draft', 'active', 'escalated', 'resolved', 'closed']),
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await (supabaseAdmin as any)
          .from('complaints')
          .update({ status: input.status, updated_at: new Date().toISOString() })
          .eq('id', input.id)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        
        return data;
      }),

    updateReference: publicProcedure
      .input(z.object({
        id: z.string(),
        complaint_reference: z.string(),
      }))
      .mutation(async ({ input }) => {
        console.log(`📝 Updating complaint reference to: ${input.complaint_reference}`);
        
        const { data, error } = await (supabaseAdmin as any)
          .from('complaints')
          .update({ 
            complaint_reference: input.complaint_reference,
            updated_at: new Date().toISOString() 
          })
          .eq('id', input.id)
          .select()
          .single();
        
        if (error) {
          console.error('❌ Failed to update reference:', error);
          throw new Error(error.message);
        }
        
        console.log('✅ Reference updated successfully');
        return data;
      }),

    assign: publicProcedure
      .input(z.object({
        complaintId: z.string(),
        userId: z.string(),
        assignedBy: z.string(),
      }))
      .mutation(async ({ input }) => {
        console.log(`👤 Assigning complaint ${input.complaintId} to user ${input.userId}`);
        
        // Update complaint
        const { data: complaint, error: complaintError } = await (supabaseAdmin as any)
          .from('complaints')
          .update({ 
            assigned_to: input.userId,
            updated_at: new Date().toISOString() 
          })
          .eq('id', input.complaintId)
          .select()
          .single();
        
        if (complaintError) {
          console.error('❌ Failed to assign complaint:', complaintError);
          throw new Error(complaintError.message);
        }
        
        // Log assignment
        const { error: assignmentError } = await (supabaseAdmin as any)
          .from('complaint_assignments')
          .insert({
            complaint_id: input.complaintId,
            assigned_to: input.userId,
            assigned_by: input.assignedBy,
            notes: 'Assigned via UI',
          });
        
        if (assignmentError) {
          console.warn('⚠️ Failed to log assignment (non-critical):', assignmentError);
          // Don't throw - assignment succeeded even if logging failed
        }
        
        console.log('✅ Complaint assigned successfully');
        return complaint;
      }),

    delete: publicProcedure
      .input(z.string())
      .mutation(async ({ input }) => {
        // Delete associated documents first (cascade should handle this, but being explicit)
        await supabaseAdmin
          .from('documents')
          .delete()
          .eq('complaint_id', input);
        
        // Delete generated letters
        await supabaseAdmin
          .from('generated_letters')
          .delete()
          .eq('complaint_id', input);
        
        // Delete the complaint
        const { error } = await supabaseAdmin
          .from('complaints')
          .delete()
          .eq('id', input);
        
        if (error) throw new Error(error.message);
        
        return { success: true };
      }),

    addTimelineEvent: publicProcedure
      .input(z.object({
        complaintId: z.string(),
        event: z.object({
          date: z.string(),
          type: z.string(),
          summary: z.string(),
          responseDeadline: z.string().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        // Get current complaint
        const { data: complaint } = await supabaseAdmin
          .from('complaints')
          .select('timeline')
          .eq('id', input.complaintId)
          .single();
        
        const currentTimeline = (complaint as any)?.timeline || [];
        const updatedTimeline = [...currentTimeline, input.event];
        
        const { data, error } = await (supabaseAdmin as any)
          .from('complaints')
          .update({ 
            timeline: updatedTimeline,
            updated_at: new Date().toISOString()
          })
          .eq('id', input.complaintId)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        
        return data;
      }),
  }),

  // Analysis
  analysis: router({
    analyzeDocument: publicProcedure
      .input(z.object({
        documentId: z.string(),
        additionalContext: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Get document
        const { data: document } = await supabaseAdmin
          .from('documents')
          .select('*')
          .eq('id', input.documentId)
          .single();
        
        if (!document) throw new Error('Document not found');
        
        // Get the complaint details including context
        const { data: complaint } = await supabaseAdmin
          .from('complaints')
          .select('*')
          .eq('id', (document as any).complaint_id)
          .single();
        
        // Get ALL documents for this complaint for comprehensive analysis
        const { data: allDocuments } = await supabaseAdmin
          .from('documents')
          .select('*')
          .eq('complaint_id', (document as any).complaint_id);
        
        // Extract complaint context (including new additional context if provided)
        const baseContext = (complaint as any)?.timeline?.[0]?.summary || 
                           (complaint as any)?.complaint_context || 
                           'No additional context provided';
        
        const complaintContext = input.additionalContext 
          ? `${baseContext}\n\nADDITIONAL CONTEXT FOR RE-ANALYSIS:\n${input.additionalContext}`
          : baseContext;
        
        // SAVE ADDITIONAL CONTEXT TO TIMELINE
        if (input.additionalContext) {
          console.log('💾 Saving additional context to timeline');
          const timeline = (complaint as any)?.timeline || [];
          const newTimelineEvent = {
            date: new Date().toISOString(),
            type: 'additional_context',
            summary: input.additionalContext,
          };
          timeline.push(newTimelineEvent);
          
          // Update complaint with new timeline
          await (supabaseAdmin as any)
            .from('complaints')
            .update({ 
              timeline,
              updated_at: new Date().toISOString()
            })
            .eq('id', (document as any).complaint_id);
          
          console.log('✅ Additional context saved to timeline');
        }
        
        console.log('📋 Starting analysis:', {
          documentCount: (allDocuments as any[])?.length || 0,
          complaintContextLength: complaintContext.length
        });
        
        // Use multi-angle search for comprehensive knowledge base coverage
        console.log('🔍 Performing multi-angle knowledge base search...');
        const guidance = await searchKnowledgeBaseMultiAngle(
          complaintContext, // Use complaint context for search, not full docs
          0.7,
          10
        );
        
        // Search precedents using combined context
        const precedents = await searchPrecedents(
          complaintContext,
          0.7,
          5
        );
        
        console.log('📚 Search results:', {
          guidanceCount: guidance.length,
          precedentsCount: precedents.length
        });
        
        // SMART CONTEXT MANAGEMENT - Prepare context within token budget
        const managedContext = prepareAnalysisContext(
          complaintContext,
          allDocuments as any[],
          guidance,
          precedents
        );
        
        console.log('✅ Context prepared, estimated tokens:', estimateTokens(managedContext));
        
        // Analyze with OpenRouter using managed context
        const analysis = await analyzeComplaint(
          sanitizeForLLM(managedContext),
          JSON.stringify(guidance.slice(0, 5)), // Top 5 guidance only
          JSON.stringify(precedents.slice(0, 3)) // Top 3 precedents only
        );
        
        // Log time (optional - don't fail if this fails)
        try {
          await logTime((document as any).complaint_id, 'analysis', 20);
        } catch (timeError) {
          console.warn('⚠️ Failed to log time, but continuing:', timeError);
        }
        
        return {
          analysis,
          guidance,
          precedents,
        };
      }),
  }),

  // Letters
  letters: router({
    generateComplaint: publicProcedure
      .input(z.object({
        complaintId: z.string(),
        analysis: z.any(),
        practiceLetterhead: z.string().optional(), // Optional: custom practice details
        chargeOutRate: z.number().optional(), // Optional: custom charge-out rate
        userName: z.string().optional(), // User's full name
        userTitle: z.string().optional(), // User's job title
        userEmail: z.string().optional(), // User's email
        userPhone: z.string().optional(), // User's phone
        useThreeStage: z.boolean().optional(), // Optional: use three-stage pipeline (default: true)
      }))
      .mutation(async ({ input }) => {
        // Get complaint details
        const { data: complaint } = await supabaseAdmin
          .from('complaints')
          .select('*')
          .eq('id', input.complaintId)
          .single();
        
        if (!complaint) throw new Error('Complaint not found');
        
        // Use three-stage pipeline by default, or single-stage if specified
        const useThreeStage = input.useThreeStage !== false; // Default to true
        
        let letter: string;
        
        if (useThreeStage) {
          console.log('🚀 Using THREE-STAGE pipeline for letter generation');
          letter = await generateComplaintLetterThreeStage(
            input.analysis,
            (complaint as any).complaint_reference,
            (complaint as any).hmrc_department || 'HMRC',
            input.practiceLetterhead,
            input.chargeOutRate,
            input.userName,
            input.userTitle,
            input.userEmail,
            input.userPhone
          );
        } else {
          console.log('📝 Using SINGLE-STAGE letter generation (legacy)');
          letter = await generateComplaintLetter(
            input.analysis,
            (complaint as any).complaint_reference,
            (complaint as any).hmrc_department || 'HMRC',
            input.practiceLetterhead,
            input.chargeOutRate
          );
        }
        
        // Log time (optional - don't fail if this fails)
        try {
          await logTime(input.complaintId, 'letter_generation', 45);
        } catch (timeError) {
          console.warn('⚠️ Failed to log time, but continuing:', timeError);
        }
        
        return { letter };
      }),

    // Save generated letter (without locking)
    save: publicProcedure
      .input(z.object({
        complaintId: z.string(),
        letterType: z.enum(['initial_complaint', 'tier2_escalation', 'adjudicator_escalation', 'rebuttal', 'acknowledgement']),
        letterContent: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await (supabaseAdmin as any)
          .from('generated_letters')
          .insert({
            complaint_id: input.complaintId,
            letter_type: input.letterType,
            letter_content: input.letterContent,
            notes: input.notes,
          })
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    // Lock letter (ready to send)
    lock: publicProcedure
      .input(z.object({
        letterId: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await (supabaseAdmin as any)
          .from('generated_letters')
          .update({ locked_at: new Date().toISOString() })
          .eq('id', input.letterId)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    // Mark letter as sent
    markAsSent: publicProcedure
      .input(z.object({
        letterId: z.string(),
        sentBy: z.string(),
        sentMethod: z.enum(['post', 'email', 'post_and_email', 'fax']),
        hmrcReference: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await (supabaseAdmin as any)
          .from('generated_letters')
          .update({
            sent_at: new Date().toISOString(),
            sent_by: input.sentBy,
            sent_method: input.sentMethod,
            hmrc_reference: input.hmrcReference,
            notes: input.notes,
          })
          .eq('id', input.letterId)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        
        // Also add to complaint timeline
        const letter = data;
        const { data: complaint } = await (supabaseAdmin as any)
          .from('complaints')
          .select('timeline')
          .eq('id', letter.complaint_id)
          .single();
        
        if (complaint) {
          const timeline = (complaint as any).timeline || [];
          timeline.push({
            date: new Date().toISOString(),
            type: 'letter_sent',
            summary: `${letter.letter_type.replace('_', ' ')} sent to HMRC via ${input.sentMethod}`,
            details: input.notes,
          });
          
          await (supabaseAdmin as any)
            .from('complaints')
            .update({ timeline })
            .eq('id', letter.complaint_id);
        }
        
        return data;
      }),

    // List letters for a complaint
    list: publicProcedure
      .input(z.object({
        complaintId: z.string(),
      }))
      .query(async ({ input }) => {
        const { data, error } = await (supabaseAdmin as any)
          .from('generated_letters')
          .select('*')
          .eq('complaint_id', input.complaintId)
          .order('created_at', { ascending: false });
        
        if (error) throw new Error(error.message);
        return data;
      }),

    // Get single letter
    getById: publicProcedure
      .input(z.string())
      .query(async ({ input }) => {
        const { data, error } = await (supabaseAdmin as any)
          .from('generated_letters')
          .select('*')
          .eq('id', input)
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    generateResponse: publicProcedure
      .input(z.object({
        complaintId: z.string(),
        correspondence: z.string(),
        responseType: z.enum(['acknowledgement', 'rebuttal', 'escalation']),
      }))
      .mutation(async ({ input }) => {
        // Get complaint context
        const { data: complaint } = await supabaseAdmin
          .from('complaints')
          .select('*')
          .eq('id', input.complaintId)
          .single();
        
        if (!complaint) throw new Error('Complaint not found');
        
        // Generate response
        const response = await generateResponse(
          complaint as any,
          input.correspondence,
          input.responseType
        );
        
        // Log time (optional - don't fail if this fails)
        try {
          await logTime(input.complaintId, 'response_drafting', 40);
        } catch (timeError) {
          console.warn('⚠️ Failed to log time, but continuing:', timeError);
        }
        
        return { response };
      }),
  }),

  // Documents
  documents: router({
    list: publicProcedure
      .input(z.string())
      .query(async ({ input }) => {
        const { data, error } = await supabaseAdmin
          .from('documents')
          .select('*')
          .eq('complaint_id', input)
          .order('uploaded_at', { ascending: false });
        
        if (error) throw new Error(error.message);
        
        return data;
      }),

    getSignedUrl: publicProcedure
      .input(z.string()) // file_path (storage path)
      .query(async ({ input }) => {
        console.log('🔗 Generating signed URL for:', input);
        
        const { data, error } = await supabaseAdmin
          .storage
          .from('complaint-documents')
          .createSignedUrl(input, 3600); // 1 hour expiry
        
        if (error) {
          console.error('❌ Failed to generate signed URL:', error);
          throw new Error(error.message);
        }
        
        console.log('✅ Generated signed URL');
        
        return { signedUrl: data.signedUrl };
      }),

    retryOCR: publicProcedure
      .input(z.string())
      .mutation(async ({ input }) => {
        console.log('🔄 Retry OCR requested for document:', input);
        
        // Get the document
        const { data: document } = await supabaseAdmin
          .from('documents')
          .select('*')
          .eq('id', input)
          .single();
        
        if (!document) throw new Error('Document not found');
        
        const doc = document as any;
        
        console.log('📋 Document metadata:', {
          id: doc.id,
          filename: doc.filename,
          file_path: doc.file_path,
          complaint_id: doc.complaint_id,
          document_type: doc.document_type
        });
        
        // Download the file from storage
        const { data: fileData, error: downloadError } = await supabaseAdmin
          .storage
          .from('complaint-documents')
          .download(doc.file_path);
        
        if (downloadError || !fileData) {
          throw new Error(`Failed to download file: ${downloadError?.message || 'Unknown error'}`);
        }
        
        console.log('📥 File downloaded, size:', fileData.size);
        
        // Convert blob to buffer
        const arrayBuffer = await fileData.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);
        
        console.log('🔄 Starting OCR retry with processDocument...');
        
        // Re-process the document (will retry OCR)
        // Use file_path as filePath since it contains the full path with filename
        await processDocument(
          fileBuffer,
          doc.complaint_id,
          doc.document_type || 'evidence',
          doc.file_path  // Full path with filename
        );
        
        console.log('✅ OCR retry complete');
        
        return { success: true };
      }),
  }),

  // Time tracking
  time: router({
    getComplaintTime: publicProcedure
      .input(z.string())
      .query(async ({ input }) => {
        const { data, error } = await (supabaseAdmin as any)
          .from('time_logs')
          .select('*')
          .eq('complaint_id', input)
          .order('created_at', { ascending: true });
        
        if (error) throw new Error(error.message);
        
        const totalMinutes = (data as any[]).reduce((sum: number, log: any) => sum + log.minutes_spent, 0);
        
        return {
          logs: data,
          totalMinutes,
          totalHours: (totalMinutes / 60).toFixed(2),
        };
      }),

    logActivity: publicProcedure
      .input(z.object({
        complaintId: z.string(),
        activity: z.string(),
        duration: z.number(), // minutes
        rate: z.number().optional(),
        notes: z.string().optional(), // For manual entries
        automated: z.boolean().optional(), // Default true for system, false for manual
      }))
      .mutation(async ({ input }) => {
        console.log('⏱️ Logging activity:', input.activity, input.duration, 'minutes');
        
        // Log time entry
        const { data: timeLog, error: timeError } = await (supabaseAdmin as any)
          .from('time_logs')
          .insert({
            complaint_id: input.complaintId,
            activity_type: input.activity,
            minutes_spent: input.duration,
            automated: input.automated !== false, // Default true
          })
          .select()
          .single();
        
        if (timeError) {
          console.error('Time logging error:', timeError);
          // Don't throw - time logging is optional
          return null;
        }
        
        // If manual entry with notes, also add to timeline
        if (input.notes && input.automated === false) {
          console.log('📝 Adding manual activity to timeline');
          
          // Get current timeline
          const { data: complaint } = await (supabaseAdmin as any)
            .from('complaints')
            .select('timeline')
            .eq('id', input.complaintId)
            .single();
          
          if (complaint) {
            const currentTimeline = complaint.timeline || [];
            const newTimelineEntry = {
              date: new Date().toISOString(),
              type: 'manual_activity',
              summary: `${input.activity} (${input.duration}m)`,
              notes: input.notes,
              duration: input.duration,
            };
            
            // Update timeline
            await (supabaseAdmin as any)
              .from('complaints')
              .update({
                timeline: [...currentTimeline, newTimelineEntry],
                updated_at: new Date().toISOString(),
              })
              .eq('id', input.complaintId);
            
            console.log('✅ Added to timeline');
          }
        }
        
        console.log('✅ Time logged successfully');
        return timeLog;
      }),

    deleteActivityByType: publicProcedure
      .input(z.object({
        complaintId: z.string(),
        activityType: z.string(),
      }))
      .mutation(async ({ input }) => {
        console.log(`🗑️ Deleting time logs for ${input.complaintId} / ${input.activityType}`);
        
        const { error } = await (supabaseAdmin as any)
          .from('time_logs')
          .delete()
          .eq('complaint_id', input.complaintId)
          .eq('activity_type', input.activityType)
          .eq('automated', true);
        
        if (error) {
          console.error('Time log deletion error:', error);
          // Don't throw - time logging is optional
          return null;
        }
        
        console.log(`✅ Deleted ${input.activityType} time logs`);
        return { success: true };
      }),

    deleteActivity: publicProcedure
      .input(z.string()) // time log ID
      .mutation(async ({ input }) => {
        console.log(`🗑️ Deleting time log: ${input}`);
        
        const { error } = await (supabaseAdmin as any)
          .from('time_logs')
          .delete()
          .eq('id', input);
        
        if (error) {
          console.error('Time log deletion error:', error);
          throw new Error(error.message);
        }
        
        console.log(`✅ Deleted time log`);
        return { success: true };
      }),
  }),

  // Knowledge base
  knowledge: router({
    search: publicProcedure
      .input(z.object({
        query: z.string(),
        threshold: z.number().optional(),
        limit: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const results = await searchKnowledgeBase(
          input.query,
          input.threshold || 0.7,
          input.limit || 10
        );
        
        return results;
      }),

    list: publicProcedure
      .input(z.object({
        searchQuery: z.string().optional(),
        category: z.string().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        let query = supabaseAdmin
          .from('knowledge_base')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (input.searchQuery) {
          query = query.textSearch('content', input.searchQuery, {
            type: 'websearch',
            config: 'english',
          });
        }
        
        if (input.category) {
          query = query.eq('category', input.category);
        }
        
        if (input.limit) {
          query = query.limit(input.limit);
        }
        
        const { data, error } = await query;
        
        if (error) throw new Error(error.message);
        return data;
      }),

    addPrecedent: publicProcedure
      .input(z.object({
        complaintId: z.string(),
        title: z.string(),
        content: z.string(),
        notes: z.string().optional(),
        category: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        console.log('📚 Adding precedent from novel complaint:', input.title);
        
        // Get the complaint details to extract proper precedent fields
        const { data: complaint, error: complaintError } = await supabaseAdmin
          .from('complaints')
          .select('*')
          .eq('id', input.complaintId)
          .single();
        
        if (complaintError) {
          console.error('❌ Failed to fetch complaint:', complaintError);
          throw new Error(complaintError.message);
        }
        
        const complaintData = complaint as any;
        
        // Generate embedding for the precedent content
        const embedding = await generateEmbedding(input.content);
        
        // Extract key arguments from the content (simplified extraction)
        // In a real system, you might want to use AI to extract these properly
        const keyArguments = [
          `${complaintData.complaint_type || 'General'} complaint`,
          input.notes || 'User-identified novel complaint pattern',
        ].filter(Boolean);
        
        // Add to precedents table with proper schema
        const { data, error } = await (supabaseAdmin as any)
          .from('precedents')
          .insert({
            complaint_type: complaintData.complaint_type || 'General',
            issue_category: input.category || 'novel',
            outcome: null, // Will be updated when complaint is resolved
            resolution_time_days: null, // Will be updated when resolved
            compensation_amount: null, // Will be updated if applicable
            key_arguments: keyArguments,
            effective_citations: [], // Can be populated from analysis if available
            embedding,
            metadata: {
              complaint_id: input.complaintId,
              complaint_reference: complaintData.complaint_reference,
              notes: input.notes,
              added_at: new Date().toISOString(),
              source_type: 'manual_user_addition',
              tags: ['user-added', 'novel-complaint', 'pending-outcome'],
              full_content: input.content, // Store the full analysis
            },
          })
          .select()
          .single();
        
        if (error) {
          console.error('❌ Failed to add precedent:', error);
          throw new Error(error.message);
        }
        
        console.log('✅ Precedent added successfully to precedents table:', data.id);
        
        return data;
      }),

    // Get knowledge base update timeline
    getTimeline: publicProcedure
      .input(z.object({
        limit: z.number().optional(),
        category: z.string().optional(),
        action: z.string().optional(),
      }))
      .query(async ({ input }) => {
        // For now, return empty until SQL function is created
        // The SQL function will be added when user runs SETUP_KNOWLEDGE_BASE_MANAGEMENT.sql
        try {
          const { data, error } = await supabaseAdmin.rpc('get_knowledge_base_timeline', {
            p_limit: input.limit || 50,
            p_category: input.category || null,
            p_action: input.action || null,
          } as any);
          
          if (error) {
            console.warn('Timeline function not available yet:', error);
            return [];
          }
          return data;
        } catch (err) {
          console.warn('Timeline query failed:', err);
          return [];
        }
      }),

    // Upload document for comparison (Stage 1: Upload & analyze)
    uploadForComparison: publicProcedure
      .input(z.object({
        filename: z.string(),
        fileBuffer: z.string(), // base64 encoded
        fileType: z.string(),
        fileSize: z.number(),
        extractedText: z.string(),
        documentChunks: z.array(z.string()),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('📤 Server-side upload for:', input.filename);
          console.log('   File type:', input.fileType);
          console.log('   File size:', input.fileSize);
          console.log('   Buffer length (base64):', input.fileBuffer?.length || 0);
          console.log('   Extracted text length:', input.extractedText?.length || 0);
          console.log('   Chunks:', input.documentChunks?.length || 0);
          
          // 1. Upload to storage (server-side with service key)
          const timestamp = Date.now();
          const cleanFilename = `${timestamp}-${input.filename}`;
          const storagePath = `knowledge-base/00000000-0000-0000-0000-000000000001/${cleanFilename}`;
          
          // Decode base64 to buffer
          const fileBuffer = Buffer.from(input.fileBuffer, 'base64');
          
          console.log(`  📤 Uploading ${fileBuffer.length} bytes to: ${storagePath}`);
          
          const { error: uploadError } = await supabaseAdmin.storage
            .from('complaint-documents')
            .upload(storagePath, fileBuffer, {
              contentType: input.fileType,
              cacheControl: '3600',
              upsert: false,
            });
          
          if (uploadError) {
            console.error('  ❌ Storage upload failed:', uploadError);
            throw new Error(`Storage upload failed: ${uploadError.message}`);
          }
          
          console.log(`  ✅ Storage upload successful`);
          
          // 2. Generate embedding for the document
          console.log('  🔄 Generating embedding...');
          const embedding = await generateEmbedding(input.extractedText);
          console.log('  ✅ Embedding generated');
        
          // 3. Check for duplicates in existing knowledge base
          console.log('  🔍 Checking for duplicates...');
          const { data: duplicates } = await supabaseAdmin.rpc('check_knowledge_duplicate', {
            p_embedding: embedding,
            p_similarity_threshold: 0.90,
          } as any) as { data: any[] | null };
          console.log(`  ✅ Found ${(duplicates as any[] || []).length} potential duplicates`);
          
          // 4. Perform AI comparison using OpenRouter
          console.log('  🤖 Performing AI comparison...');
          const { compareDocumentToKnowledgeBase } = await import('@/lib/knowledgeComparison');
          const comparisonResult = await compareDocumentToKnowledgeBase(
            input.extractedText,
            input.documentChunks,
            duplicates || []
          );
          console.log('  ✅ AI comparison complete');
          
          // 5. Save to staging for review
          console.log('  💾 Saving to staging...');
          const { data, error } = await (supabaseAdmin as any)
            .from('knowledge_base_staging')
            .insert({
              uploaded_by: '', // TODO: Get from auth context
              filename: input.filename,
              file_path: storagePath,
              file_type: input.fileType,
              file_size: input.fileSize,
              extracted_text: input.extractedText,
              document_chunks: input.documentChunks,
              embedding,
              comparison_result: comparisonResult,
              status: 'pending',
            })
            .select()
            .single();
          
          if (error) {
            console.error('  ❌ Failed to save to staging:', error);
            throw new Error(error.message);
          }
          
          console.log('  ✅ Saved to staging successfully');
          
          return {
            stagingId: data.id,
            comparison: comparisonResult,
            duplicates: duplicates || [],
          };
        } catch (err: any) {
          console.error('❌ Upload for comparison failed:', err);
          console.error('   Stack:', err.stack);
          throw new Error(`Upload failed: ${err.message}`);
        }
      }),

    // List RSS feeds
    listRssFeeds: publicProcedure
      .query(async () => {
        try {
          const { data, error } = await (supabaseAdmin as any)
            .from('rss_feeds')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (error) {
            console.warn('RSS feeds table not available yet:', error);
            return [];
          }
          return data;
        } catch (err) {
          console.warn('RSS feeds query failed:', err);
          return [];
        }
      }),

    // Approve staged document and add to knowledge base
    approveStaged: publicProcedure
      .input(z.object({
        stagedId: z.string(),
      }))
      .mutation(async ({ input }) => {
        console.log('✅ Approving staged document:', input.stagedId);
        
        // Get staged document
        const { data: staged, error: stagedError } = await supabaseAdmin
          .from('knowledge_base_staging')
          .select('*')
          .eq('id', input.stagedId)
          .single();
        
        if (stagedError) throw new Error(stagedError.message);
        
        const stagedDoc = staged as any;
        
        // Add to knowledge base
        const { data: kbEntry, error: kbError } = await (supabaseAdmin as any)
          .from('knowledge_base')
          .insert({
            title: stagedDoc.title,
            content: stagedDoc.content,
            category: stagedDoc.category,
            source: stagedDoc.source,
            file_path: stagedDoc.file_path,
            embedding: stagedDoc.embedding,
            metadata: stagedDoc.metadata,
            organization_id: stagedDoc.organization_id,
          })
          .select()
          .single();
        
        if (kbError) throw new Error(kbError.message);
        
        // Log to updates timeline
        await (supabaseAdmin as any)
          .from('knowledge_base_updates')
          .insert({
            kb_id: kbEntry.id,
            action: 'added',
            title: stagedDoc.title,
            category: stagedDoc.category,
            source: stagedDoc.source,
            user_name: 'Admin', // TODO: Use actual user from context
            organization_id: stagedDoc.organization_id,
          });
        
        // Delete from staging
        await supabaseAdmin
          .from('knowledge_base_staging')
          .delete()
          .eq('id', input.stagedId);
        
        console.log('✅ Document approved and added to knowledge base');
        
        return { success: true, kbId: kbEntry.id };
      }),

    // Get RSS feed statistics
    getRssStats: publicProcedure
      .query(async () => {
        try {
          const { data, error } = await supabaseAdmin.rpc('get_rss_feed_stats');
          
          if (error) {
            console.warn('RSS stats function not available yet:', error);
            return {
              total_feeds: 0,
              active_feeds: 0,
              total_items_processed: 0,
              items_added_today: 0,
              pending_items: 0,
            };
          }
          return data[0] || {
            total_feeds: 0,
            active_feeds: 0,
            total_items_processed: 0,
            items_added_today: 0,
            pending_items: 0,
          };
        } catch (err) {
          console.warn('RSS stats query failed:', err);
          return {
            total_feeds: 0,
            active_feeds: 0,
            total_items_processed: 0,
            items_added_today: 0,
            pending_items: 0,
          };
        }
      }),
  }),

  // AI Settings
  aiSettings: router({
    // List all prompts
    listPrompts: publicProcedure
      .query(async () => {
        try {
          const { data, error } = await (supabaseAdmin as any)
            .from('ai_prompts')
            .select('*')
            .order('prompt_category', { ascending: true })
            .order('prompt_name', { ascending: true });
          
          if (error) {
            console.warn('AI prompts table not available yet:', error);
            return [];
          }
          return data;
        } catch (err) {
          console.warn('AI prompts query failed:', err);
          return [];
        }
      }),

    // Get single prompt
    getPrompt: publicProcedure
      .input(z.object({
        promptKey: z.string(),
      }))
      .query(async ({ input }) => {
        const { data, error } = await (supabaseAdmin as any)
          .from('ai_prompts')
          .select('*')
          .eq('prompt_key', input.promptKey)
          .eq('is_active', true)
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    // Update prompt
    updatePrompt: publicProcedure
      .input(z.object({
        promptId: z.string(),
        systemPrompt: z.string(),
        userPromptTemplate: z.string().nullable().optional(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const updateData: any = {
          system_prompt: input.systemPrompt,
          last_modified_at: new Date().toISOString(),
        };

        if (input.userPromptTemplate !== undefined) {
          updateData.user_prompt_template = input.userPromptTemplate;
        }
        if (input.temperature !== undefined) {
          updateData.temperature = input.temperature;
        }
        if (input.maxTokens !== undefined) {
          updateData.max_tokens = input.maxTokens;
        }

        // TODO: Add last_modified_by from auth context

        const { data, error } = await (supabaseAdmin as any)
          .from('ai_prompts')
          .update(updateData)
          .eq('id', input.promptId)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        
        console.log('✅ Prompt updated:', data.prompt_name, 'v' + data.version);
        return data;
      }),

    // Reset prompt to default
    resetPrompt: publicProcedure
      .input(z.object({
        promptId: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await (supabaseAdmin as any)
          .from('ai_prompts')
          .update({
            system_prompt: (supabaseAdmin as any).raw('default_system_prompt'),
            user_prompt_template: (supabaseAdmin as any).raw('default_user_prompt_template'),
            is_custom: false,
            last_modified_at: new Date().toISOString(),
          })
          .eq('id', input.promptId)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        
        console.log('✅ Prompt reset to default:', data.prompt_name);
        return data;
      }),

    // Get prompt history
    getPromptHistory: publicProcedure
      .input(z.object({
        promptId: z.string(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const { data, error } = await (supabaseAdmin as any)
          .from('ai_prompt_history')
          .select('*')
          .eq('prompt_id', input.promptId)
          .order('version', { ascending: false })
          .limit(input.limit || 10);
        
        if (error) throw new Error(error.message);
        return data;
      }),
  }),

  // Knowledge Base Chat
  kbChat: router({
    // Start new conversation
    startConversation: publicProcedure
      .mutation(async () => {
        // TODO: Get user_id from auth context
        const userId = '00000000-0000-0000-0000-000000000001'; // Placeholder
        
        const { data, error } = await (supabaseAdmin as any)
          .from('kb_chat_conversations')
          .insert({
            user_id: userId,
            title: 'New conversation',
          })
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),

    // Send message and get response
    sendMessage: publicProcedure
      .input(z.object({
        conversationId: z.string(),
        message: z.string(),
        conversationHistory: z.array(z.object({
          role: z.enum(['user', 'assistant', 'system']),
          content: z.string(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const startTime = Date.now();
        
        // Save user message
        const { data: userMessage, error: userError } = await (supabaseAdmin as any)
          .from('kb_chat_messages')
          .insert({
            conversation_id: input.conversationId,
            role: 'user',
            content: input.message,
          })
          .select()
          .single();
        
        if (userError) throw new Error(userError.message);
        
        // Get AI response
        const { chatWithKnowledgeBase, generateConversationTitle } = await import('@/lib/knowledgeBaseChat');
        const response = await chatWithKnowledgeBase(
          input.message,
          input.conversationHistory || []
        );
        
        const processingTime = Date.now() - startTime;
        
        // Save assistant message
        const { data: assistantMessage, error: assistantError } = await (supabaseAdmin as any)
          .from('kb_chat_messages')
          .insert({
            conversation_id: input.conversationId,
            role: 'assistant',
            content: response.answer,
            knowledge_base_chunks: response.knowledgeChunks,
            sources: response.sources,
            processing_time_ms: processingTime,
          })
          .select()
          .single();
        
        if (assistantError) throw new Error(assistantError.message);
        
        // Update conversation title if this is the first message
        const { data: conversation } = await (supabaseAdmin as any)
          .from('kb_chat_conversations')
          .select('message_count, title')
          .eq('id', input.conversationId)
          .single();
        
        if (conversation && conversation.message_count === 2 && conversation.title === 'New conversation') {
          const title = await generateConversationTitle(input.message);
          await (supabaseAdmin as any)
            .from('kb_chat_conversations')
            .update({ title })
            .eq('id', input.conversationId);
        }
        
        return {
          userMessage,
          assistantMessage,
          sources: response.sources,
        };
      }),

    // Get conversation history
    getConversation: publicProcedure
      .input(z.object({
        conversationId: z.string(),
      }))
      .query(async ({ input }) => {
        const { data: messages, error } = await (supabaseAdmin as any)
          .from('kb_chat_messages')
          .select('*')
          .eq('conversation_id', input.conversationId)
          .order('created_at', { ascending: true });
        
        if (error) throw new Error(error.message);
        return messages;
      }),

    // List user's conversations
    listConversations: publicProcedure
      .query(async () => {
        // TODO: Get user_id from auth context
        const userId = '00000000-0000-0000-0000-000000000001'; // Placeholder
        
        try {
          const { data, error } = await supabaseAdmin.rpc('get_user_kb_conversations', {
            p_user_id: userId,
            p_limit: 50,
          } as any);
          
          if (error) {
            console.warn('Chat conversations not available yet:', error);
            return [];
          }
          return data;
        } catch (err) {
          console.warn('Chat query failed:', err);
          return [];
        }
      }),

    // Delete conversation
    deleteConversation: publicProcedure
      .input(z.object({
        conversationId: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { error } = await (supabaseAdmin as any)
          .from('kb_chat_conversations')
          .delete()
          .eq('id', input.conversationId);
        
        if (error) throw new Error(error.message);
        return { success: true };
      }),

    // Submit feedback on message
    submitFeedback: publicProcedure
      .input(z.object({
        messageId: z.string(),
        isHelpful: z.boolean(),
        feedbackText: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // TODO: Get user_id from auth context
        const userId = '00000000-0000-0000-0000-000000000001'; // Placeholder
        
        const { data, error } = await (supabaseAdmin as any)
          .from('kb_chat_feedback')
          .upsert({
            message_id: input.messageId,
            user_id: userId,
            is_helpful: input.isHelpful,
            feedback_text: input.feedbackText,
          })
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        return data;
      }),
  }),

  // Users
  users: router({
    list: publicProcedure
      .query(async () => {
        const { data, error } = await (supabaseAdmin as any)
          .from('lightpoint_users')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw new Error(error.message);
        
        return data;
      }),

    create: publicProcedure
      .input(z.object({
        email: z.string().email(),
        full_name: z.string(),
        role: z.enum(['admin', 'manager', 'analyst', 'viewer']),
        job_title: z.string().optional(),
        phone: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Get default organization (in a real app, use auth context)
        const orgId = '00000000-0000-0000-0000-000000000001';
        
        const { data, error } = await (supabaseAdmin as any)
          .from('lightpoint_users')
          .insert({
            organization_id: orgId,
            email: input.email,
            full_name: input.full_name,
            role: input.role,
            job_title: input.job_title,
            phone: input.phone,
            is_active: true,
          })
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        
        return data;
      }),

    update: publicProcedure
      .input(z.object({
        id: z.string(),
        email: z.string().email().optional(),
        full_name: z.string().optional(),
        role: z.enum(['admin', 'manager', 'analyst', 'viewer']).optional(),
        job_title: z.string().optional(),
        phone: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        
        const { data, error } = await (supabaseAdmin as any)
          .from('lightpoint_users')
          .update({
            ...updateData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        
        return data;
      }),

    toggleStatus: publicProcedure
      .input(z.string())
      .mutation(async ({ input }) => {
        // Get current status
        const { data: user } = await (supabaseAdmin as any)
          .from('lightpoint_users')
          .select('is_active')
          .eq('id', input)
          .single();
        
        const { data, error } = await (supabaseAdmin as any)
          .from('lightpoint_users')
          .update({ 
            is_active: !user.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', input)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        
        return data;
      }),

    invite: publicProcedure
      .input(z.object({
        email: z.string().email(),
        full_name: z.string(),
        role: z.enum(['admin', 'manager', 'analyst', 'viewer']),
        job_title: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        console.log(`📧 Inviting user: ${input.email}`);
        
        // Get default organization
        const orgId = '00000000-0000-0000-0000-000000000001';
        
        // Create user in auth.users via admin API
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          input.email,
          {
            data: {
              full_name: input.full_name,
              role: input.role,
              job_title: input.job_title,
            },
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
          }
        );
        
        if (authError) {
          console.error('❌ Failed to invite user:', authError);
          throw new Error(authError.message);
        }
        
        // Create profile in lightpoint_users
        const { data: profile, error: profileError } = await (supabaseAdmin as any)
          .from('lightpoint_users')
          .insert({
            id: authData.user.id,
            organization_id: orgId,
            email: input.email,
            full_name: input.full_name,
            role: input.role,
            job_title: input.job_title,
            is_active: true,
          })
          .select()
          .single();
        
        if (profileError) {
          console.error('❌ Failed to create user profile:', profileError);
          // Try to delete the auth user if profile creation failed
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          throw new Error(profileError.message);
        }
        
        console.log('✅ User invited successfully');
        return profile;
      }),
  }),

  // Tickets
  tickets: router({
    create: publicProcedure
      .input(z.object({
        complaintId: z.string(),
        subject: z.string(),
        description: z.string(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']),
      }))
      .mutation(async ({ input }) => {
        // In a real app, get raised_by from auth context
        const raisedBy = '00000000-0000-0000-0000-000000000002';
        
        const { data, error } = await (supabaseAdmin as any)
          .from('management_tickets')
          .insert({
            complaint_id: input.complaintId,
            raised_by: raisedBy,
            subject: input.subject,
            description: input.description,
            priority: input.priority,
            status: 'open',
          })
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        
        return data;
      }),

    list: publicProcedure
      .query(async () => {
        const { data, error } = await (supabaseAdmin as any)
          .from('ticket_summary')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw new Error(error.message);
        
        return data;
      }),

    getByComplaint: publicProcedure
      .input(z.string())
      .query(async ({ input }) => {
        const { data, error } = await (supabaseAdmin as any)
          .from('ticket_summary')
          .select('*')
          .eq('complaint_id', input)
          .order('created_at', { ascending: false });
        
        if (error) throw new Error(error.message);
        
        return data;
      }),

    update: publicProcedure
      .input(z.object({
        id: z.string(),
        status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
        assigned_to: z.string().optional(),
        resolution_notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        
        const updatePayload: any = {
          ...updateData,
          updated_at: new Date().toISOString(),
        };
        
        if (updateData.status === 'resolved' || updateData.status === 'closed') {
          updatePayload.resolved_at = new Date().toISOString();
        }
        
        const { data, error } = await (supabaseAdmin as any)
          .from('management_tickets')
          .update(updatePayload)
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        
        return data;
      }),

    addComment: publicProcedure
      .input(z.object({
        ticketId: z.string(),
        comment: z.string(),
      }))
      .mutation(async ({ input }) => {
        // In a real app, get user_id from auth context
        const userId = '00000000-0000-0000-0000-000000000002';
        
        const { data, error } = await (supabaseAdmin as any)
          .from('ticket_comments')
          .insert({
            ticket_id: input.ticketId,
            user_id: userId,
            comment: input.comment,
          })
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        
        return data;
      }),
  }),

  // Management
  management: router({
    getOverview: publicProcedure
      .query(async () => {
        // Get management overview from view
        const { data: users, error: usersError } = await (supabaseAdmin as any)
          .from('management_overview')
          .select('*');
        
        if (usersError) throw new Error(usersError.message);
        
        // Get totals
        const totalUsers = users?.length || 0;
        const totalComplaints = users?.reduce((sum: number, u: any) => sum + (u.total_complaints || 0), 0) || 0;
        const openTickets = users?.reduce((sum: number, u: any) => sum + (u.open_tickets || 0), 0) || 0;
        const totalMinutes = users?.reduce((sum: number, u: any) => sum + (u.total_minutes_logged || 0), 0) || 0;
        
        return {
          total_users: totalUsers,
          total_complaints: totalComplaints,
          open_tickets: openTickets,
          total_minutes: totalMinutes,
          users,
        };
      }),
  }),

});

export type AppRouter = typeof appRouter;

