# Email codes: one-time Supabase setup

The app now logs in, confirms sign-ups and resets passwords with an 8-digit code
emailed to the user. The code in the repo is ready; these dashboard steps are
what make the emails actually carry a code. Everything here is on free tiers.

## 1. Put the code in the three email templates

Supabase dashboard > **Authentication > Emails** (called "Email Templates" in
older dashboards). Edit each of these and make sure the body contains
`{{ .Token }}`. You can keep the link too, but the code is what the app asks for.

**Confirm signup** (sent when someone creates an account)

    Subject: Your Danum confirmation code
    Body:
    <h2>Welcome to Danum</h2>
    <p>Your confirmation code is:</p>
    <h1 style="letter-spacing:6px">{{ .Token }}</h1>
    <p>It expires in 1 hour. If you didn't sign up, ignore this email.</p>

**Magic Link** (this is the template used for "Email me a code" log in)

    Subject: Your Danum log in code
    Body:
    <h2>Log in to Danum</h2>
    <p>Your log in code is:</p>
    <h1 style="letter-spacing:6px">{{ .Token }}</h1>
    <p>It expires in 1 hour. If you didn't ask for this, ignore this email.</p>

**Reset Password** (sent from "Forgot password")

    Subject: Your Danum password reset code
    Body:
    <h2>Reset your password</h2>
    <p>Your reset code is:</p>
    <h1 style="letter-spacing:6px">{{ .Token }}</h1>
    <p>It expires in 1 hour. If you didn't ask for this, ignore this email.</p>

## 2. Check the email provider settings

**Authentication > Providers > Email**

- **Confirm email**: ON (otherwise sign-up skips the code step).
- **Email OTP Length**: 8 (the app expects 8 digits; this is Supabase's default).
- **Email OTP Expiration**: the default (3600 seconds) is fine.

## 3. Set up a free SMTP sender (important)

Supabase's built-in email sender is limited to a few emails per hour, so real
users would be blocked. Use your own SMTP. Brevo's free plan needs no domain of
your own.

1. Create a free account at brevo.com.
2. In Brevo: **Senders, Domains & Dedicated IPs > Senders**, add and verify the
   email address you want codes to come from.
3. In Brevo: **SMTP & API > SMTP**, create an **SMTP key** and copy it.
4. In Supabase: **Authentication > Emails > SMTP Settings** (or Project Settings >
   Authentication), turn on **Custom SMTP** and fill in:
   - Host: `smtp-relay.brevo.com`
   - Port: `587`
   - Username: your Brevo SMTP login (shown on that same Brevo page)
   - Password: the SMTP key from step 3
   - Sender email: the address you verified in step 2
   - Sender name: `Danum`
5. After saving, open **Authentication > Rate Limits** and raise "emails sent per
   hour" if you want more than the default.

Free-plan limits change, so check Brevo's pricing page for the current daily cap.

## 4. Try it

1. Sign up with a real email. You should get the "Confirm signup" email with a code.
2. Log out, then use "Email me a code" on the log in page. You should get the
   "Magic Link" email with a code.
3. Try "Forgot password?" from the "Use my password instead" screen.

If no email arrives: check spam, then Supabase **Logs > Auth** for SMTP errors
(usually an unverified sender or a wrong SMTP key).

## Notes

- Log in with a code never creates an account. New people use **Sign up**.
- The login screen doesn't reveal whether an email has an account.
- Passwords still work: tap "Use my password instead" on the log in page.
- The old link-based pages (`/auth/confirm`, `/auth/update-password`) are left in
  place, so any link-style email that is still in someone's inbox keeps working.
