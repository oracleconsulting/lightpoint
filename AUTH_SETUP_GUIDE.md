# LIGHTPOINT AUTHENTICATION SETUP GUIDE

## Current System vs Production System

### 🔧 CURRENT (Development):
- localStorage-based user switching
- Manual user selection from /settings
- No passwords, no security
- Perfect for demo/testing

### 🔐 PRODUCTION (Recommended):
- Supabase Auth with email/password
- Real login page with credentials
- Secure, scalable, proper auth
- Invite system for new users

---

## 🎯 IMPLEMENTING PRODUCTION AUTH

### OPTION 1: Supabase Auth + Email/Password (Recommended)

#### Step 1: Enable Email Auth in Supabase

1. **Go to Supabase Dashboard** → Authentication → Settings
2. **Enable Email Provider**
3. **Configure Email Templates:**
   - Sign up confirmation
   - Password reset
   - Email change confirmation

#### Step 2: Install Supabase Auth Package

```bash
npm install @supabase/auth-helpers-nextjs @supabase/supabase-js
```

#### Step 3: Create Auth Context

**File: `contexts/AuthContext.tsx`**

```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: any;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Sync with lightpoint_users table
          await syncUserProfile(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const syncUserProfile = async (authUser: any) => {
    // Check if user exists in lightpoint_users
    const { data: existingUser } = await supabase
      .from('lightpoint_users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (!existingUser) {
      // Create user profile
      await supabase
        .from('lightpoint_users')
        .insert({
          id: authUser.id,
          email: authUser.email,
          organization_id: '00000000-0000-0000-0000-000000000001', // Default org
          role: 'viewer', // Default role - admin must upgrade
          is_active: true,
        });
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    router.push('/dashboard');
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signUp, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

#### Step 4: Create Login Page

**File: `app/login/page.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Lightpoint Login
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### Step 5: Protect Routes with Middleware

**File: `middleware.ts`**

```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protect all routes except login
  if (!session && !req.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Redirect to dashboard if already logged in and accessing login
  if (session && req.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

#### Step 6: Update UserContext to Use Auth

```typescript
// contexts/UserContext.tsx
import { useAuth } from '@/contexts/AuthContext';

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth();
  const { data: userData } = trpc.users.getById.useQuery(authUser?.id, {
    enabled: !!authUser,
  });

  // ... rest of context using userData from database
}
```

---

## 👥 ADDING NEW USERS (Production)

### Method 1: Admin Invite System (Best UX)

```typescript
// Add to your /users page
const inviteUser = async (email: string, role: string) => {
  // 1. Create user in lightpoint_users
  const { data: newUser } = await supabase
    .from('lightpoint_users')
    .insert({
      email,
      role,
      organization_id: currentUser.organization_id,
      is_active: false, // Inactive until they confirm
    })
    .select()
    .single();

  // 2. Send invite email via Supabase Auth
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      user_id: newUser.id,
      role,
    },
    redirectTo: `${window.location.origin}/auth/accept-invite`,
  });

  if (error) throw error;
  
  alert(`Invite sent to ${email}!`);
};
```

### Method 2: Self-Service Signup (Open Registration)

1. User goes to `/signup`
2. Enters email + password
3. Receives confirmation email
4. Clicks link to verify
5. Account created with 'viewer' role
6. Admin upgrades role if needed

### Method 3: Manual (Current Approach)

1. Admin adds user to database (SQL)
2. Admin sends temporary password separately
3. User logs in with email/password
4. Forces password change on first login

---

## 📋 COMPARISON

| Feature | Current (localStorage) | Production (Supabase Auth) |
|---------|----------------------|---------------------------|
| **Security** | ❌ None | ✅ Encrypted passwords |
| **User Management** | Manual DB inserts | Built-in invite system |
| **Password Reset** | ❌ N/A | ✅ Automatic emails |
| **Session Management** | ❌ None | ✅ Secure tokens |
| **Mobile Support** | ❌ Limited | ✅ Full support |
| **Setup Time** | ✅ 5 minutes | ⏱️ 1-2 hours |
| **Cost** | ✅ Free | ✅ Free (50k users) |

---

## 🎯 RECOMMENDATION

### For Now (MVP/Demo):
**Keep current system:**
- Add users via SQL
- Share `/settings` link
- They switch to their account
- Fast, simple, works

### For Production (Real Users):
**Implement Supabase Auth:**
- Proper login page
- Invite system
- Password resets
- Session management
- Takes 1-2 hours to set up

---

## ⚡ QUICK START (Current System)

**To add a user RIGHT NOW:**

1. **Run SQL:**
```sql
INSERT INTO lightpoint_users (
  organization_id, email, full_name, role, is_active
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'newuser@example.com',
  'New User Name',
  'analyst',
  true
);
```

2. **Send them:**
   - Link: `https://lightpoint-production.up.railway.app/settings`
   - Instructions: "Go to settings, find your name, click Switch"

3. **Done!** They can now use the system.

---

## 📞 NEXT STEPS

Ready to implement real auth? Just say:
- "Let's add Supabase Auth" 
- "Set up the invite system"
- "Create the login page"

And I'll implement it for you! 🚀

