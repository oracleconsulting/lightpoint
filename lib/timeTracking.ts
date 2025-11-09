import { supabaseAdmin } from '@/lib/supabase/client';

/**
 * Log time spent on complaint activities
 */
export const logTime = async (
  complaintId: string,
  activityType: string,
  minutesSpent: number,
  automated: boolean = true
) => {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('time_logs')
      .insert({
        complaint_id: complaintId,
        activity_type: activityType,
        minutes_spent: minutesSpent,
        automated,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Time logging error:', error);
    throw new Error('Failed to log time');
  }
};

/**
 * Get total time spent on a complaint
 */
export const getComplaintTime = async (complaintId: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('time_logs')
      .select('activity_type, minutes_spent, automated, created_at')
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    const totalMinutes = data.reduce((sum, log) => sum + log.minutes_spent, 0);
    const automaticMinutes = data
      .filter(log => log.automated)
      .reduce((sum, log) => sum + log.minutes_spent, 0);
    const manualMinutes = totalMinutes - automaticMinutes;
    
    return {
      logs: data,
      totalMinutes,
      automaticMinutes,
      manualMinutes,
      totalHours: (totalMinutes / 60).toFixed(2),
    };
  } catch (error) {
    console.error('Get complaint time error:', error);
    throw new Error('Failed to retrieve time logs');
  }
};

/**
 * Activity time estimates (in minutes)
 */
export const TIME_ESTIMATES = {
  document_upload: 5,
  document_review: 15,
  analysis: 20,
  letter_generation: 45,
  letter_review: 30,
  response_drafting: 40,
  escalation_preparation: 60,
  research: 30,
  precedent_review: 20,
};

