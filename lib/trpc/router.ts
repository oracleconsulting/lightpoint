import { router, publicProcedure } from './trpc';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/client';
import { processDocument } from '@/lib/documentProcessor';
import { analyzeComplaint, generateComplaintLetter, generateResponse } from '@/lib/openrouter/client';
import { searchKnowledgeBase, searchPrecedents } from '@/lib/vectorSearch';
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
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await (supabaseAdmin as any)
          .from('complaints')
          .insert({
            organization_id: input.organizationId,
            created_by: input.createdBy,
            client_reference: input.clientReference,
            complaint_type: input.complaintType,
            hmrc_department: input.hmrcDepartment,
            status: 'assessment',
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
        let query = supabaseAdmin
          .from('complaints')
          .select('*')
          .eq('organization_id', input.organizationId);
        
        if (input.status) {
          query = query.eq('status', input.status);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw new Error(error.message);
        
        return data;
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
        const { data, error } = await supabaseAdmin
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
        
        const currentTimeline = complaint?.timeline || [];
        const updatedTimeline = [...currentTimeline, input.event];
        
        const { data, error } = await supabaseAdmin
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
        
        // Search knowledge base
        const guidance = await searchKnowledgeBase(
          JSON.stringify(document.processed_data),
          0.7,
          5
        );
        
        // Search precedents
        const precedents = await searchPrecedents(
          JSON.stringify(document.processed_data),
          0.7,
          5
        );
        
        // Analyze with OpenRouter
        const analysis = await analyzeComplaint(
          sanitizeForLLM(document.processed_data),
          JSON.stringify(guidance),
          JSON.stringify(precedents)
        );
        
        // Log time
        await logTime(document.complaint_id, 'analysis', 20);
        
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
          complaint.client_reference,
          complaint.hmrc_department || 'HMRC'
        );
        
        // Log time
        await logTime(input.complaintId, 'letter_generation', 45);
        
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
          complaint,
          input.correspondence,
          input.responseType
        );
        
        // Log time
        await logTime(input.complaintId, 'response_drafting', 40);
        
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
        
        const totalMinutes = data.reduce((sum, log) => sum + log.minutes_spent, 0);
        
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

