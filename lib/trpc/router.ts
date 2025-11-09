import { router, publicProcedure } from './trpc';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/client';
import { processDocument } from '@/lib/documentProcessor';
import { analyzeComplaint, generateComplaintLetter, generateResponse } from '@/lib/openrouter/client';
import { searchKnowledgeBase, searchKnowledgeBaseMultiAngle, searchPrecedents } from '@/lib/vectorSearch';
import { logTime } from '@/lib/timeTracking';
import { sanitizeForLLM } from '@/lib/privacy';

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
          
          let query = supabaseAdmin
            .from('complaints')
            .select('*')
            .eq('organization_id', input.organizationId);
          
          if (input.status) {
            query = query.eq('status', input.status);
          }
          
          const { data, error } = await query.order('created_at', { ascending: false });
          
          console.log('📋 Supabase response:', { 
            hasData: !!data, 
            dataCount: data?.length, 
            hasError: !!error,
            errorDetails: error 
          });
          
          if (error) {
            console.error('❌ Supabase error details:', JSON.stringify(error, null, 2));
            throw new Error(`Supabase error: ${error.message} (${error.code || 'no code'})`);
          }
          
          return data;
        } catch (err: any) {
          console.error('❌ Complaints list error:', err);
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
        
        // Combine all document text and complaint context
        const allDocumentText = (allDocuments as any[])
          ?.map((doc: any) => JSON.stringify(doc.processed_data))
          .join('\n\n--- NEXT DOCUMENT ---\n\n') || '';
        
        const complaintContext = (complaint as any)?.timeline?.[0]?.summary || 
                                (complaint as any)?.complaint_context || 
                                'No additional context provided';
        
        const fullContext = `
COMPLAINT CONTEXT:
${complaintContext}

ALL DOCUMENTS:
${allDocumentText}
        `.trim();
        
        console.log('📋 Analyzing with full context:', {
          documentCount: (allDocuments as any[])?.length || 0,
          contextLength: fullContext.length,
          hasComplaintContext: !!complaintContext
        });
        
        // Use multi-angle search for comprehensive knowledge base coverage
        console.log('🔍 Performing multi-angle knowledge base search...');
        const guidance = await searchKnowledgeBaseMultiAngle(
          fullContext,
          0.7,
          10
        );
        
        // Search precedents using combined context
        const precedents = await searchPrecedents(
          fullContext,
          0.7,
          5
        );
        
        console.log('📚 Search results:', {
          guidanceCount: guidance.length,
          precedentsCount: precedents.length
        });
        
        // Analyze with OpenRouter using ALL context
        const analysis = await analyzeComplaint(
          sanitizeForLLM(fullContext),
          JSON.stringify(guidance),
          JSON.stringify(precedents)
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
      }))
      .mutation(async ({ input }) => {
        // Get complaint details
        const { data: complaint } = await supabaseAdmin
          .from('complaints')
          .select('*')
          .eq('id', input.complaintId)
          .single();
        
        if (!complaint) throw new Error('Complaint not found');
        
        // Generate letter
        const letter = await generateComplaintLetter(
          input.analysis,
          (complaint as any).complaint_reference,
          (complaint as any).hmrc_department || 'HMRC'
        );
        
        // Log time (optional - don't fail if this fails)
        try {
          await logTime(input.complaintId, 'letter_generation', 45);
        } catch (timeError) {
          console.warn('⚠️ Failed to log time, but continuing:', timeError);
        }
        
        return { letter };
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
  }),

  // Time tracking
  time: router({
    getComplaintTime: publicProcedure
      .input(z.string())
      .query(async ({ input }) => {
        const { data, error } = await supabaseAdmin
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
        category: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let query = supabaseAdmin
          .from('knowledge_base')
          .select('*');
        
        if (input.category) {
          query = query.eq('category', input.category);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw new Error(error.message);
        
        return data;
      }),
  }),
});

export type AppRouter = typeof appRouter;

