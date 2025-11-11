# Lightpoint Complaint System - Active Status Implementation

## 🎯 Implementation Summary

### Components Created:
1. **StatusManager** (`components/complaint/StatusManager.tsx`)
   - Visual status display with lifecycle timeline
   - "Mark as Active" button (assessment → active)
   - "Escalate to Tier 2" button (active → escalated)
   - "Mark as Resolved" button (escalated → resolved)
   - Status badges and icons

2. **TimeTracker** (`components/complaint/TimeTracker.tsx`)
   - Automated time tracking display
   - Shows: activity, duration, rate, value
   - Total time and total value calculations
   - Invoiceable time breakdown
   - Activity icons (Analysis, Letter, Response, Review)

3. **ResponseUploader** (`components/complaint/ResponseUploader.tsx`)
   - Upload HMRC response documents
   - Add context for response
   - Triggers document processing
   - Updates timeline

### Still Needed:
1. **Integrate components into complaint detail page**
2. **Add tRPC endpoints for time tracking**
3. **Create 28-day deadline tracking system**
4. **Build follow-up letter generator with context**
5. **Auto-track time for activities**
6. **Update dashboard to filter by status**

## 📋 Next Steps

### Integration into Complaint Detail Page:

```typescript
// Add to imports
import { StatusManager } from '@/components/complaint/StatusManager';
import { TimeTracker } from '@/components/complaint/TimeTracker';
import { ResponseUploader } from '@/components/complaint/ResponseUploader';

// In the left column, replace Actions card with:
<StatusManager
  complaintId={params.id}
  currentStatus={complaintData.status}
  onStatusChange={() => {
    // Refresh data
    utils.complaints.getById.invalidate(params.id);
  }}
/>

// Add TimeTracker below StatusManager
<TimeTracker
  complaintId={params.id}
  entries={timeData?.logs || []}
  chargeOutRate={practiceSettings?.chargeOutRate || 250}
/>

// For ACTIVE complaints, show ResponseUploader in right column
{complaintData.status === 'active' && (
  <ResponseUploader
    complaintId={params.id}
    onResponseUploaded={() => {
      // Refresh timeline
      utils.documents.list.invalidate(params.id);
    }}
  />
)}
```

### Time Tracking Implementation:

Need to add tRPC mutations to auto-track time:

```typescript
// In lib/trpc/router.ts - time router
logActivity: publicProcedure
  .input(z.object({
    complaintId: z.string(),
    activity: z.string(),
    duration: z.number(), // minutes
    rate: z.number(),
  }))
  .mutation(async ({ input }) => {
    const { data, error } = await supabaseAdmin
      .from('time_logs')
      .insert({
        complaint_id: input.complaintId,
        activity: input.activity,
        duration_minutes: input.duration,
        rate_per_hour: input.rate,
        timestamp: new Date().toISOString(),
      });
    
    if (error) throw new Error(error.message);
    return data;
  }),
```

### Auto-track time for activities:

1. **Analysis**: 30-60 minutes (based on document count)
2. **Letter Generation**: 15-30 minutes
3. **Response Review**: 20-40 minutes
4. **Follow-up Letter**: 15-25 minutes

### 28-Day Deadline Tracking:

Add to timeline when letter is sent to HMRC:
- Calculate deadline: sentDate + 28 days
- Show countdown in timeline
- Alert when < 7 days remaining
- Auto-suggest follow-up when deadline passed

### Follow-up Letter Generator:

When 28 days passed or response received:
- Re-analyze with new context
- Reference original letter
- Include "We wrote to you on [date]"
- Escalate language if no response
- Auto-track time (20 minutes)

## 🚀 Usage Flow

1. **Assessment Phase**:
   - Upload documents
   - Analyze complaint
   - Generate initial letter
   - Click "Mark as Active"

2. **Active Phase**:
   - Letter marked as sent
   - 28-day countdown starts
   - Can upload HMRC response
   - Can generate follow-up letter
   - Time tracked automatically

3. **Escalated Phase**:
   - Escalated to Tier 2/Adjudicator
   - Continue correspondence
   - Track all activities

4. **Resolved Phase**:
   - Complaint successful
   - Final time summary
   - Total value calculation
   - Export for invoicing

## 💰 Time Tracking Examples

| Activity | Duration | Rate | Value |
|----------|----------|------|-------|
| Initial Analysis | 45m | £250/hr | £187.50 |
| Letter Generation | 20m | £250/hr | £83.33 |
| Response Review | 30m | £250/hr | £125.00 |
| Follow-up Letter | 20m | £250/hr | £83.33 |
| **TOTAL** | **2h 15m** | | **£479.16** |

## 🎨 UI Improvements

The components include:
- ✅ Clear status badges with colors
- ✅ Progress timeline
- ✅ One-click status transitions
- ✅ Automatic time tracking display
- ✅ Total value at a glance
- ✅ Response upload for active complaints
- ✅ Context addition for all uploads

## 📦 Files Created

- `components/complaint/StatusManager.tsx` ✅
- `components/complaint/TimeTracker.tsx` ✅
- `components/complaint/ResponseUploader.tsx` ✅
- `ACTIVE_STATUS_IMPLEMENTATION.md` ✅ (this file)

## Next: Integration & Testing

Run the integration to connect these components to the complaint detail page.

