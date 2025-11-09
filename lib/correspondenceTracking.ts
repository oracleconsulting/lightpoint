import { supabaseAdmin } from '@/lib/supabase/client';
import { addDays } from 'date-fns';

/**
 * Track correspondence and update complaint timeline
 */
export const trackCorrespondence = async (
  complaintId: string,
  correspondence: {
    type: 'sent' | 'received' | 'internal';
    summary: string;
    documentId?: string;
  }
) => {
  try {
    // Get current complaint
    const { data: complaint } = await supabaseAdmin
      .from('complaints')
      .select('timeline')
      .eq('id', complaintId)
      .single();
    
    const currentTimeline = (complaint as any)?.timeline || [];
    
    // Create timeline event
    const event = {
      date: new Date().toISOString(),
      type: correspondence.type,
      summary: correspondence.summary,
      documentId: correspondence.documentId,
      responseDeadline: correspondence.type === 'sent' 
        ? addDays(new Date(), 28).toISOString() 
        : undefined,
    };
    
    const updatedTimeline = [...currentTimeline, event];
    
    // Update complaint with explicit any type
    const { data, error } = await (supabaseAdmin
      .from('complaints')
      .update({
        timeline: updatedTimeline,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', complaintId)
      .select()
      .single());
    
    if (error) throw error;
    
    // Check for escalation triggers
    await checkEscalationTriggers(complaintId);
    
    return data;
  } catch (error) {
    console.error('Track correspondence error:', error);
    throw new Error('Failed to track correspondence');
  }
};

/**
 * Check if complaint should be escalated
 */
export const checkEscalationTriggers = async (complaintId: string) => {
  try {
    const { data: complaint } = await supabaseAdmin
      .from('complaints')
      .select('*')
      .eq('id', complaintId)
      .single();
    
    if (!complaint) return;
    
    const timeline = complaint.timeline || [];
    const now = new Date();
    
    // Check for overdue responses
    const overdueEvents = timeline.filter((event: any) => {
      if (event.responseDeadline) {
        const deadline = new Date(event.responseDeadline);
        return now > deadline && event.type === 'sent';
      }
      return false;
    });
    
    // Escalate if more than 2 overdue responses
    if (overdueEvents.length >= 2 && complaint.status !== 'escalated') {
      await supabaseAdmin
        .from('complaints')
        .update({
          status: 'escalated',
          updated_at: now.toISOString(),
        })
        .eq('id', complaintId);
      
      // Add escalation event to timeline
      const escalationEvent = {
        date: now.toISOString(),
        type: 'internal',
        summary: 'Complaint automatically escalated due to overdue responses',
      };
      
      await supabaseAdmin
        .from('complaints')
        .update({
          timeline: [...timeline, escalationEvent],
        })
        .eq('id', complaintId);
    }
  } catch (error) {
    console.error('Check escalation triggers error:', error);
  }
};

/**
 * Get complaints needing attention (overdue responses)
 */
export const getComplaintsNeedingAttention = async (organizationId: string) => {
  try {
    const { data: complaints } = await supabaseAdmin
      .from('complaints')
      .select('*')
      .eq('organization_id', organizationId)
      .in('status', ['active', 'escalated']);
    
    if (!complaints) return [];
    
    const now = new Date();
    
    const needingAttention = complaints.filter(complaint => {
      const timeline = complaint.timeline || [];
      return timeline.some((event: any) => {
        if (event.responseDeadline) {
          const deadline = new Date(event.responseDeadline);
          const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return daysUntilDeadline <= 7 && daysUntilDeadline >= 0;
        }
        return false;
      });
    });
    
    return needingAttention;
  } catch (error) {
    console.error('Get complaints needing attention error:', error);
    throw new Error('Failed to retrieve complaints needing attention');
  }
};

