import { Redirect } from 'expo-router';

// In the web version, Google sends the sign-in popup back to this page.
// Importing the Google helper runs maybeCompleteAuthSession(), which hands
// the result to the main window and closes the popup.
import '@/lib/google';

export default function AuthCallback() {
  return <Redirect href="/" />;
}
