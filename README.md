# Drive Master Academy

Lesson booking app for Drive Master Academy. Students book 1 or 2 hour lessons with their assigned instructor; instructors accept, decline, edit or cancel them. Built with React Native (Expo) and Supabase, with Google Calendar for instructor availability.

## What phase 1 includes

- **Sign-in for both roles.** Students create an account with email, username and password, then sign in with either their username or email and add their name and phone. Instructors sign in with Google, which also connects their Google Calendar.
- **Instructor accounts.** Only emails listed in the `instructor_invites` table become instructors. Everyone else is a student.
- **Assigning students.** An instructor adds a student by email on the *My students* screen. Students only see (and can later only book) their assigned instructor.
- **Google Calendar connection.** The instructor's Google refresh token is stored server-side. The home screen can list their busy times for the next 7 days to prove the connection works.
- **Database rules for later phases,** already enforced and tested: lessons must be 1 or 2 hours, an instructor can never have two overlapping pending/confirmed lessons, students can only book their assigned instructor, and students can only cancel 24 hours or more before a lesson.

Booking screens, accepting/editing/cancelling lessons and notifications come in phases 2 and 3.

## Project layout

```
src/app/            Screens (Expo Router: every file is a route)
  (auth)/           Sign-in, complete profile
  student/          Student home
  instructor/       Instructor home, My students
src/lib/            Supabase client, auth context, Google Calendar helpers
src/components/     Shared UI pieces
supabase/
  migrations/       Database schema, rules and security policies
  functions/        Edge functions: save-google-token, calendar-busy
  tests/            SQL test of the booking rules
```

## One-time setup

You need [Node.js](https://nodejs.org) 20 or newer, a free [Supabase](https://supabase.com) account and a Google account that can use [Google Cloud Console](https://console.cloud.google.com).

### 1. Install

```bash
npm install
```

### 2. Create the Supabase project

1. Create a new project at supabase.com.
2. Open **SQL Editor** and run each file in `supabase/migrations/` in order (0001, 0002, 0003, ...).
3. Add your instructors' Google emails (lowercase), also in the SQL Editor:
   ```sql
   insert into instructor_invites (email) values
     ('instructor1@gmail.com'),
     ('instructor2@gmail.com'),
     ('instructor3@gmail.com');
   ```
4. Put the Project URL and anon key from **Project Settings > API** in `src/lib/config.ts` (already filled in for the Drive Master Academy project).

### 3. Student sign-in

In Supabase, go to **Authentication > Sign In / Providers > Email** and turn **Confirm email** off, then save. Students can then create an account and sign in straight away. (Supabase's built-in email sender is limited to a few emails an hour, so confirmation emails are not reliable without your own email provider.)

### 4. Google sign-in and calendar access

1. In Google Cloud Console, create a project and enable the **Google Calendar API**.
2. Configure the **OAuth consent screen** (External, app name "Drive Master Academy") and add the scopes `.../auth/calendar.readonly` and `.../auth/calendar.events`. While the app is in testing, add your 3 instructors as test users.
3. Create an **OAuth client ID** of type *Web application*. Under *Authorized redirect URIs* add `https://<your-project-ref>.supabase.co/auth/v1/callback`.
4. In Supabase, go to **Authentication > Providers > Google**, turn it on and paste the client ID and secret.
5. In Supabase, go to **Authentication > URL Configuration** and add these redirect URLs: `dmaapp://auth/callback` and `exp://**` (the second one is for testing in Expo Go).

### 5. Deploy the edge functions

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase secrets set GOOGLE_CLIENT_ID=<client id> GOOGLE_CLIENT_SECRET=<client secret>
npx supabase functions deploy --remote=<your-project-ref> --use-api --no-verify-jwt
```

After the first setup, GitHub deploys the functions automatically whenever
`supabase/functions` changes on `main` (`.github/workflows/deploy-functions.yml`).
It needs one repository secret, `SUPABASE_ACCESS_TOKEN`, created at
supabase.com/dashboard/account/tokens.

## Web version

The same code runs as a website, so the app can be shared as a link:

```bash
npm run build:web   # builds the site into dist/
```

`vercel.json` tells [Vercel](https://vercel.com) how to build it. Import the GitHub repository in Vercel and every push goes live automatically. In Supabase, add the site's address followed by `/auth/callback` (for example `https://dma-app.vercel.app/auth/callback`) under **Authentication > URL Configuration > Redirect URLs** so instructors can sign in with Google on the web.

## Run the app

```bash
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone (iOS or Android). Create a student account with your email and a password, or as an instructor with one of the invited Google accounts.

## Checks

```bash
npm run typecheck
```

`supabase/tests/rules_test.sql` exercises the booking rules against a plain Postgres database (load `tests/auth_stub.sql`, then the migration, then the test).
