# Email Verification Flow - Visual Diagrams

## Complete User Journey

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      WME PORTAL EMAIL VERIFICATION                       │
│                             COMPLETE FLOW                                │
└──────────────────────────────────────────────────────────────────────────┘

                              🔵 USER STARTS HERE

                                    ↓ ↓ ↓

                    ┌───────────────────────────────┐
                    │   1️⃣  REGISTRATION PAGE       │
                    │        (/register)            │
                    ├───────────────────────────────┤
                    │ Form Fields:                  │
                    │ ✓ Full Name                   │
                    │ ✓ Email Address               │
                    │ ✓ Password (8+ chars)         │
                    │ ✓ Role (Buyer/Talent)         │
                    │                               │
                    │ [Create Account] Button       │
                    └───────┬───────────────────────┘
                            │
                      🔄 SERVER ACTION
                      registerAction()
                            │
                  ┌─────────┴──────────┐
                  │                    │
            ✅ Success         ❌ Error
                  │                    │
                  ↓                    ↓
         (Supabase User         (Show Error
          + App Row Created)     Message)
                  │
                  ↓
    ┌──────────────────────────────────┐
    │ 2️⃣  CHECK EMAIL PAGE             │
    │     (/auth/check-email)          │
    ├──────────────────────────────────┤
    │                                  │
    │  ✉️  Check Your Email            │
    │                                  │
    │  Sent confirmation link to:      │
    │  📧 user@company.com             │
    │                                  │
    │  Steps:                          │
    │  1️⃣  Check your inbox           │
    │  2️⃣  Click "CONFIRM EMAIL"      │
    │  3️⃣  Get taken to dashboard     │
    │                                  │
    └──────────┬───────────────────────┘
               │
      👤 USER OPENS EMAIL
      📧 Clicks Confirmation Link
               │
               ↓
    ┌──────────────────────────────────┐
    │ 3️⃣  EMAIL CALLBACK HANDLER       │
    │     (/auth/callback)             │
    ├──────────────────────────────────┤
    │                                  │
    │  ⏳ Verifying Email...           │
    │                                  │
    │  (Loading Spinner)               │
    │                                  │
    └──────────┬───────────────────────┘
               │
          🔐 VERIFICATION
    • Get user from Supabase
    • Check email_confirmed_at
    • Set localStorage flag
               │
         ┌─────┴──────┐
         │            │
      ✅ Valid    ❌ Invalid
         │            │
         ↓            ↓
    Get User      Show Error
    Get Role      (3 sec timer)
         │            │
         ↓            ↓
    Set Flag      Redirect
    Redirect      to /login
         │
         ↓
    ┌──────────────────────────────────┐
    │ 4️⃣  USER DASHBOARD LOADED        │
    │     (/buyer or /talent)          │
    ├──────────────────────────────────┤
    │                                  │
    │ Page renders with portal content │
    │                                  │
    └──────────┬───────────────────────┘
               │
         🎨 COMPONENT RENDER
    WelcomePopup mounts
    useEffect triggers
               │
         Check localStorage
         for 'newlyVerified'
               │
         ┌─────┴──────┐
         │            │
    Found=TRUE   Not Found
         │            │
         ↓            ↓
    Show Modal   Don't show
         │
         ↓
    ┌──────────────────────────────────┐
    │ 5️⃣  WELCOME POPUP 🎉             │
    ├──────────────────────────────────┤
    │                                  │
    │  ✨ Welcome to WME Portal!       │
    │                                  │
    │  Hi Alice Cooper, your email     │
    │  has been verified and your      │
    │  account is ready to go!         │
    │                                  │
    │  What's Next:                    │
    │  • Access Your Portal            │
    │  • Complete Your Profile         │
    │  • Get Support                   │
    │                                  │
    │  [Get Started] ◄─ CLICK          │
    │                                  │
    └──────────┬───────────────────────┘
               │
        Clear localStorage
        Close modal
               │
               ↓
    ┌──────────────────────────────────┐
    │ 6️⃣  READY TO USE PORTAL ✅       │
    ├──────────────────────────────────┤
    │                                  │
    │ Dashboard fully visible          │
    │ User can navigate portal         │
    │ Sidebar, tabs, forms available   │
    │                                  │
    └──────────────────────────────────┘

                            🟢 SUCCESS!
```

---

## Component Hierarchy

```
RootLayout
├── AuthProvider
│   └── [Page Content]
│       ├── LoginPage
│       ├── RegisterPage
│       │   └── registerAction() [Server Action]
│       ├── /auth/callback/page
│       │   └── handleCallback()
│       ├── /auth/check-email/page
│       ├── BuyerPortal (/buyer)
│       │   ├── useAuth()
│       │   └── WelcomePopup ⭐
│       │       ├── useEffect (check flag)
│       │       ├── Modal backdrop
│       │       └── Welcome content
│       └── TalentPortal (/talent)
│           ├── useAuth()
│           └── WelcomePopup ⭐
│               ├── useEffect (check flag)
│               ├── Modal backdrop
│               └── Welcome content
```

---

## Data Flow - Authentication & User Creation

```
┌────────────────────────────────────────────────────────────────┐
│                    REGISTRATION DATA FLOW                      │
└────────────────────────────────────────────────────────────────┘

USER SUBMITS FORM
     ↓
FormData {
  name: "Alice Cooper"
  email: "alice@example.com"
  password: "SecurePass123"
  role: "BUYER"
}
     ↓
registerAction(formData)
     ↓
INPUT VALIDATION [Zod Schema]
  ├─ email: valid email format ✓
  ├─ password: min 8 chars ✓
  ├─ name: not empty ✓
  └─ role: 'BUYER' | 'TALENT' ✓
     ↓
SUPABASE AUTH LAYER
  ├─ supabase.auth.signUp({
  │    email: "alice@example.com"
  │    password: "SecurePass123"
  │    options: {
  │      data: {
  │        name: "Alice Cooper"
  │        role: "BUYER"
  │      }
  │    }
  │  })
  │
  ├─ Creates auth user in Supabase
  ├─ Stores metadata (name, role)
  ├─ Generates verification token
  ├─ Sends email with link:
  │  "{{ .SiteURL }}/auth/callback?token=..."
  │
  └─ Returns: {
       user: {
         id: "auth-uuid-123"
         email: "alice@example.com"
         user_metadata: {
           name: "Alice Cooper"
           role: "BUYER"
         }
       }
     }
     ↓
APP USER TABLE LAYER
  ├─ supabase
  │   .from('User')
  │   .insert({
  │     id: "app-uuid-456"          ← unique app ID
  │     email: "alice@example.com"
  │     name: "Alice Cooper"
  │     role: "BUYER"
  │     auth_user_id: "auth-uuid-123" ← links to auth
  │     createdAt: "2024-01-15T..."
  │     updatedAt: "2024-01-15T..."
  │   })
  │
  └─ Creates row in User table
     ↓
RESPONSE TO CLIENT
  ├─ Success { success: true }
  └─ Redirect to /auth/check-email
     ↓
DATABASE STATE NOW:
  ├─ Supabase Auth Table:
  │  id: "auth-uuid-123"
  │  email: "alice@example.com"
  │  user_metadata: { name, role }
  │  email_confirmed_at: null  ← NOT YET VERIFIED
  │
  └─ App User Table:
     id: "app-uuid-456"
     email: "alice@example.com"
     name: "Alice Cooper"
     role: "BUYER"
     auth_user_id: "auth-uuid-123"
```

---

## Email Verification Flow

```
┌────────────────────────────────────────────────────────────────┐
│                  EMAIL VERIFICATION DATA FLOW                  │
└────────────────────────────────────────────────────────────────┘

EMAIL SENT
├─ Supabase Auth sends email to: alice@example.com
│
├─ Email contains link:
│  https://yourapp.com/auth/callback?token_hash=xyz&type=signup
│
└─ Email subject: "Confirm your signup"

     ↓ ↓ ↓

USER CLICKS EMAIL LINK
     ↓
Browser navigates to:
/auth/callback?token_hash=xyz&type=signup
     ↓
Next.js routes to: /auth/callback/page.tsx
     ↓
useEffect() hook triggers
     ↓
CALLBACK HANDLER EXECUTES
     ├─ supabase.auth.getUser()
     │  └─ Gets current session user
     │     Returns: {
     │       id: "auth-uuid-123"
     │       email: "alice@example.com"
     │       email_confirmed_at: "2024-01-15T10:30:00Z" ✅ NOW SET!
     │       user_metadata: {
     │         name: "Alice Cooper"
     │         role: "BUYER"
     │       }
     │     }
     │
     ├─ Check: email_confirmed_at exists? ✓ YES
     │
     ├─ Get role from metadata: "BUYER"
     │
     ├─ localStorage.setItem('newlyVerified', 'true')
     │  └─ Sets flag for welcome popup
     │
     ├─ Display success message
     │  ✅ "Email verified successfully!"
     │
     └─ router.push('/buyer')
        └─ Redirects to buyer dashboard
        └─ After 1.5 second delay
     ↓
BUYER PORTAL LOADS
     ├─ Page component mounts
     ├─ useAuth() hook loads user data:
     │  ├─ Supabase getUser()
     │  ├─ Fetch User row from DB
     │  └─ Set AppUser context
     │
     ├─ WelcomePopup component mounts
     │  ├─ useEffect(() => {
     │  │    const flag = localStorage.getItem('newlyVerified')
     │  │    if (flag && user) {
     │  │      setIsOpen(true)
     │  │      localStorage.removeItem('newlyVerified')
     │  │    }
     │  │  }, [user])
     │  │
     │  └─ Shows modal!
     │
     └─ User sees welcome popup 🎉
```

---

## State Management

```
┌──────────────────────────────────────────────────────────────┐
│               STATE MANAGEMENT & PERSISTENCE                 │
└──────────────────────────────────────────────────────────────┘

SUPABASE PERSISTENT STATE
├─ Auth Table:
│  ├─ user.id (UUID)
│  ├─ user.email
│  ├─ user.email_confirmed_at ← Verification marker
│  ├─ user.user_metadata:
│  │  ├─ name
│  │  └─ role
│  └─ Persists across sessions
│
└─ App User Table:
   ├─ id (App UUID)
   ├─ email
   ├─ name
   ├─ role
   ├─ auth_user_id (link to auth)
   └─ Persists across sessions

CONTEXT STATE (React Memory)
├─ AuthContext:
│  ├─ user (AppUser object)
│  ├─ loading (boolean)
│  └─ logout (function)
│
└─ Shared across all components via useAuth()

COMPONENT STATE (React Memory)
├─ BuyerPortal/TalentPortal:
│  ├─ activeTab
│  ├─ bookings
│  ├─ contracts
│  ├─ loading
│  └─ sidebarOpen
│
└─ WelcomePopup:
   ├─ isOpen (boolean)
   └─ Auto-closes after "Get Started"

LOCAL STORAGE (Browser)
├─ newlyVerified:
│  ├─ Set: "true" (after email verification)
│  ├─ Read: On dashboard mount
│  ├─ Cleared: After popup displayed
│  └─ Purpose: Trigger welcome popup once
│
└─ Only contains non-sensitive flag

URL PARAMETERS
├─ /auth/check-email?email=alice@example.com
│  └─ Displays email to user in confirmation page
│
└─ /auth/callback?token_hash=...&type=signup
   └─ Handled by Supabase, triggers verification
```

---

## Error Handling Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING FLOWS                        │
└────────────────────────────────────────────────────────────────┘

REGISTRATION ERRORS:

Invalid Email Format
  └─ Caught by: Zod validation
  └─ Shows: "Invalid email format"
  └─ User: Can retry

Password Too Short
  └─ Caught by: Zod validation
  └─ Shows: "Password must be at least 8 characters"
  └─ User: Can retry

Email Already Registered
  └─ Caught by: Supabase auth.signUp()
  └─ Shows: "Email already registered"
  └─ User: Sign in instead

DB Insert Error
  └─ Caught by: User table insert
  └─ Auth user cleaned up
  └─ Shows: "Failed to create user profile"
  └─ User: Can retry

───────────────────────────────────

EMAIL VERIFICATION ERRORS:

Invalid/Expired Token
  └─ Caught by: /auth/callback
  └─ supabase.auth.getUser() returns null
  └─ Shows: "Email verification failed"
  └─ Redirects: /login after 3 seconds
  └─ User: Can register again

Email Not Confirmed
  └─ Caught by: email_confirmed_at check
  └─ Shows: "Email confirmation pending"
  └─ User: Check inbox again

Network Error
  └─ Caught by: try/catch
  └─ Shows: "An error occurred"
  └─ Redirects: /login after 3 seconds
  └─ User: Can try again

───────────────────────────────────

ERROR STATES IN UI:

Registration Page
  └─ Shows red error alert box
  └─ Error persists until user retries
  └─ Form remains filled

Check Email Page
  └─ Static page (no errors)
  └─ Provides help links

Callback Page
  ├─ Loading state: Spinner visible
  ├─ Success state: Green checkmark, message
  └─ Error state: Red X, error message

Dashboard
  └─ If not authenticated: Redirects to /login
  └─ Error alerts for data loading failures
```

---

## Timeline

```
User Action Timeline:

T+0s     │ User submits registration form
T+0.5s   │ Register page shows loading state
T+1s     │ Page redirects to check-email
T+1s     │ Check email page loads
         │
T+X min  │ User opens email
T+X min  │ User clicks confirmation link
         │
T+X min  │ Callback page shows loading spinner
T+X min  │ Supabase verifies token
T+X.5s   │ Shows success message
T+X+1.5s │ Redirects to dashboard
         │
T+X+2s   │ Dashboard loads
T+X+2s   │ WelcomePopup checks localStorage
T+X+2s   │ Modal animates in
         │
T+X+Y s  │ User clicks "Get Started"
T+X+Y s  │ Modal closes
T+X+Y s  │ Portal ready to use ✅
```

---

## Summary

This diagram shows that the email verification flow:
1. ✅ Is **clearly defined** with distinct stages
2. ✅ Has **error handling** at each step
3. ✅ Uses **multiple data storage layers** (Auth, DB, Context, LocalStorage)
4. ✅ Provides **immediate visual feedback** to user
5. ✅ Smoothly transitions to **ready state**
