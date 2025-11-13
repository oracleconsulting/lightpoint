# 🚀 USER MANAGEMENT SYSTEM - SETUP GUIDE

## Overview
Complete multi-user system with role-based access control, complaint attribution, and management ticketing.

---

## 📋 STEP 1: Database Setup

1. **Open Supabase SQL Editor** (your project dashboard)
2. **Run the setup script:**
   ```
   supabase/SETUP_USER_MANAGEMENT.sql
   ```
3. **Verify tables created:**
   - `complaint_assignments`
   - `management_tickets`
   - `ticket_comments`
   - Enhanced: `lightpoint_users`, `complaints`, `time_logs`
   - Views: `management_overview`, `ticket_summary`

---

## 👤 STEP 2: Set Your User (Development)

For testing, manually set yourself as the current user:

**Open browser console (F12) and run:**

```javascript
// Option 1: Set as Admin
localStorage.setItem('lightpoint_current_user', JSON.stringify({
  id: '00000000-0000-0000-0000-000000000002',  // Your user ID from DB
  email: 'your.email@example.com',
  full_name: 'Your Name',
  role: 'admin',  // 'admin', 'manager', 'analyst', or 'viewer'
  organization_id: '00000000-0000-0000-0000-000000000001',
  is_active: true
}))

// Refresh page
location.reload()
```

**Or get your actual user ID from Supabase:**
```sql
SELECT * FROM lightpoint_users WHERE email = 'your.email@example.com';
```

---

## 🎯 STEP 3: Access The System

Once logged in as a user with appropriate role:

### For Admins/Managers:
- **Dashboard**: `/dashboard` - Main complaint list
- **Users**: `/users` - Manage team members
- **Management**: `/management` - Oversight dashboard & tickets

### For All Users:
- **Dashboard**: `/dashboard` - View complaints
- **Complaint Detail**: `/complaints/[id]` - Work on complaints
- **Flag to Management**: Button on complaint page

---

## 👥 ROLES & PERMISSIONS

| Role     | Access Level                                    |
|----------|-------------------------------------------------|
| **Admin**   | Full system access + user management         |
| **Manager** | Oversight dashboard + user management        |
| **Analyst** | Create/edit complaints + raise tickets       |
| **Viewer**  | Read-only access to complaints               |

---

## 🎫 HOW TO USE TICKETS

### As an Analyst:
1. Go to a complaint: `/complaints/[id]`
2. Scroll to "Flag to Management" button
3. Select priority (Low/Medium/High/Urgent)
4. Enter subject + description
5. Click "Raise Ticket"

### As a Manager:
1. Go to: `/management`
2. Click "Tickets" tab
3. See all open tickets sorted by priority
4. Click "Respond" to add comments
5. Update status: Open → In Progress → Resolved → Closed

---

## 👤 HOW TO ADD TEAM MEMBERS

1. Go to: `/users`
2. Click "Add User"
3. Fill in:
   - Email (required)
   - Full Name (required)
   - Role (required)
   - Job Title (optional)
   - Phone (optional)
4. Click "Add User"
5. User appears in team list

**To edit:** Hover over user → Click edit icon → Update details → Save

**To deactivate:** Hover over user → Click X icon (won't delete, just deactivates)

---

## 📊 MANAGEMENT OVERSIGHT

### Overview Tab:
- **Team Stats:** Total users, active complaints, open tickets, hours logged
- **Per-User Breakdown:**
  - Total complaints assigned
  - Active complaints
  - Open tickets
  - Time logged
  - Last login

### Tickets Tab:
- **Filter by status:** All, Open, In Progress, Resolved, Closed
- **Quick actions:**
  - Respond to ticket
  - Mark In Progress
  - Mark Resolved
  - View linked complaint

---

## 🔐 PRODUCTION AUTH SETUP (Later)

When ready for real authentication, replace localStorage with Supabase Auth:

```typescript
// contexts/UserContext.tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

useEffect(() => {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      // Fetch user from lightpoint_users table
      // Set currentUser state
    }
  });
}, []);
```

---

## 🎨 UI FEATURES

### Navigation (Top Right):
- **Practice Settings** (all users)
- **Users** (admin/manager only)
- **Management** (admin/manager only)
- **New Complaint** (all users)

### Complaint Page:
- **Existing Tickets** (shows all tickets for this complaint)
- **Flag to Management** (button to raise new ticket)
- **Time Tracker** (shows who logged time)

### Management Dashboard:
- **Color-coded priorities:**
  - Red border = Urgent
  - Orange border = High
  - Blue border = Medium/Low
- **Status badges:**
  - Blue = Open
  - Yellow = In Progress
  - Green = Resolved
  - Gray = Closed

---

## 🐛 TROUBLESHOOTING

### "You don't have permission" message:
- Check your role in localStorage (see Step 2)
- Ensure `role` is 'admin' or 'manager' for management pages
- Refresh page after setting user

### Tickets not showing:
- Run the SQL setup script (Step 1)
- Check console for errors
- Verify `management_tickets` table exists

### User list empty:
- Run: `SELECT * FROM lightpoint_users;`
- Add users manually or via UI

---

## 📝 EXAMPLE WORKFLOW

**Scenario:** Junior analyst needs help with complex complaint

1. **Analyst (Sarah):**
   - Working on complaint #ABC-123
   - Unsure about CRG interpretation
   - Clicks "Flag to Management"
   - Priority: High
   - Subject: "Need guidance on CRG4025 interpretation"
   - Description: "Client has 18-month delay but HMRC claims it's 'reasonable' due to backlog. Need advice on how to counter this."
   - Clicks "Raise Ticket"

2. **Manager (You):**
   - Notification appears (future: email)
   - Go to /management → Tickets tab
   - See Sarah's ticket with High priority
   - Click "Respond"
   - Add comment: "CRG4025 states 'reasonable' is max 12 months for routine matters. Backlog doesn't change the standard. Reference CRG section 3.2.1 and cite the Charter's 'reasonable delay' definition."
   - Update status: Resolved
   - Click "Send"

3. **Analyst (Sarah):**
   - Sees resolution (future: email notification)
   - Uses guidance to update complaint letter
   - Marks ticket as Closed

---

## 🎯 QUICK LINKS

- **Dashboard:** `/dashboard`
- **Users:** `/users`
- **Management:** `/management`
- **Practice Settings:** `/settings`
- **New Complaint:** `/complaints/new`

---

## ✅ VERIFICATION CHECKLIST

- [ ] SQL script run successfully
- [ ] Current user set in localStorage
- [ ] Can access /dashboard
- [ ] Admin/Manager can access /users
- [ ] Admin/Manager can access /management
- [ ] Can add new users
- [ ] Can edit user roles
- [ ] Can raise ticket from complaint page
- [ ] Ticket appears in management dashboard
- [ ] Can respond to ticket
- [ ] Can update ticket status

---

**🎉 You're all set!** Your team can now collaborate on HMRC complaints with full attribution and escalation support.

