# Email Verification Setup Guide

## Overview
This guide explains how the complete email verification flow works in the WME Portal, from registration through dashboard access with a welcome popup.

## Flow Diagram

```
User Registration
     ↓
Check Email Page (Email Sent Confirmation)
     ↓
User Clicks "CONFIRM EMAIL" Link in Email
     ↓
Auth Callback Handler (auth/callback)
     ↓
Email Verified ✓
     ↓
Redirected to Dashboard (Buyer/Talent)
     ↓
Welcome Popup Shows
     ↓
User Sees Dashboard
```

## Components

### 1. **Registration Page** (`/register`)
- User fills in name, email, password, and role (BUYER or TALENT)
- On submit, `registerAction` is called which:
  - Creates Supabase Auth user with email
  - Creates app-level User row in database
  - Returns success/error
- On success, redirects to `/auth/check-email?email=<user-email>`

### 2. **Check Email Page** (`/auth/check-email`)
- Shows confirmation that email was sent
- Displays user email address
- Provides step-by-step instructions:
  1. Open your email
  2. Click the confirmation link
  3. You'll be taken to your dashboard
- Includes troubleshooting tips
- Has a link back to registration if needed

### 3. **Email Callback Handler** (`/auth/callback`)
- Automatically triggered when user clicks email verification link
- Verifies that email is confirmed in Supabase
- Sets `localStorage.setItem('newlyVerified', 'true')` flag
- Redirects to appropriate dashboard based on user role:
  - TALENT role → `/talent`
  - BUYER role → `/buyer`
- Shows loading state and success/error messages

### 4. **Welcome Popup Component** (`/components/WelcomePopup.tsx`)
- Checks for `newlyVerified` flag in localStorage
- Only shows for newly verified users
- Displays personalized welcome message with user name
- Shows 3 key actions:
  1. Access Your Portal
  2. Complete Your Profile
  3. Get Support
- Has "Get Started" button to dismiss
- Automatically clears the flag after showing

## Supabase Configuration Required

### Email Templates
You need to configure your Supabase email confirmation template to include the callback URL:

In your Supabase project settings:
1. Go to **Authentication → Email Templates**
2. Edit the **Confirm signup** template
3. Make sure the confirmation link includes:
   ```
   {{ .ConfirmationURL }}/auth/callback
   ```

**Default Supabase URL format:**
```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change
```

### RLS Policies (Already in place)
- Users can only read their own data
- Service role bypasses RLS for registration

## Key Files Modified/Created

| File | Purpose |
|------|---------|
| `/app/auth/callback/page.tsx` | Email verification callback handler |
| `/app/auth/check-email/page.tsx` | Confirmation page after registration |
| `/components/WelcomePopup.tsx` | Welcome popup shown to new verified users |
| `/app/register/page.tsx` | Updated to redirect to check-email page |
| `/app/buyer/page.tsx` | Added WelcomePopup component |
| `/app/talent/page.tsx` | Added WelcomePopup component |

## Testing the Flow

### Step 1: Test Registration
1. Go to `/register`
2. Fill in: Name, Email, Password (8+ chars), Role
3. Should redirect to `/auth/check-email?email=your-email`

### Step 2: Test Email Confirmation
1. Check the email inbox (or check Supabase email logs)
2. Click the "CONFIRM EMAIL" link
3. Should show loading screen then success
4. Should redirect to `/buyer` or `/talent` based on role

### Step 3: Test Welcome Popup
1. After email confirmation and redirect, welcome popup should appear
2. Should show user's name and welcome message
3. Should have 3 action items listed
4. Click "Get Started" to dismiss

## Environment Variables

Make sure these are set in your Supabase project:

```
NEXT_PUBLIC_SUPABASE_URL=<your-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

## Error Scenarios

### Email Not Verified
- User tries to sign in before confirming email
- Will fail auth check (auth.signInWithPassword)
- Display error message

### Invalid/Expired Token
- Old or corrupted email confirmation link
- `/auth/callback` shows error: "Email verification failed"
- Redirects to login after 3 seconds
- User can register again

### Database Issues
- Auth user created but app User row fails
- Registration cleans up auth user on failure
- User sees: "Failed to create user profile"
- Can try registering again

## User Experience Improvements

✓ Clean, intuitive flow from registration to dashboard  
✓ Clear confirmation page prevents confusion  
✓ Loading state during email verification  
✓ Welcome popup celebrates new user  
✓ Personalized greeting with user's name  
✓ Role-based redirect (Buyer vs Talent)  
✓ Error handling with clear messages  
✓ Mobile-responsive design  

## Security Considerations

✓ Email verification required before portal access  
✓ Supabase handles token generation and validation  
✓ LocalStorage flag prevents replay of welcome popup  
✓ Service role key never exposed to frontend  
✓ All auth operations server-side  
✓ Database User row linked to auth user  

## Future Enhancements

- Add resend email confirmation link option
- Add email verification status indicator
- Track first login date in database
- A/B test different welcome messages
- Add profile completion progress on welcome popup
