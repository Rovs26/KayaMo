import { Button } from '@kayamo/ui';
import { signOut } from '../login/actions';

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="secondary" size="lg">
        Sign out
      </Button>
    </form>
  );
}
