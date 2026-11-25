import { StudentDetailsForm } from '@/components/StudentDetailsForm';

/** Every new student fills in their details once, and accepts the Terms and Conditions. */
export default function CompleteProfile() {
  return <StudentDetailsForm mode="setup" />;
}
