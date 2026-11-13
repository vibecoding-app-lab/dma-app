import { Redirect } from 'expo-router';

// Email codes were replaced by email + password sign-in. Kept as a redirect
// so old links still land on the sign-in screen.
export default function Verify() {
  return <Redirect href="/sign-in" />;
}
