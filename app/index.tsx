import { Redirect } from 'expo-router';

export default function Index() {
  // Redirige directamente al login
  return <Redirect href="./login" />;
}
