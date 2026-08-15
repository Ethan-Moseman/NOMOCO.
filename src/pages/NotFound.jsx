import { Page } from '../components/Layout';
import { Button, EmptyState } from '../components/UI';

export default function NotFound() {
  return (
    <Page>
      <EmptyState
        title="Page not found"
        message="That link does not go anywhere. Let's get you back to the lawn."
        action={
          <Button as="link" to="/">
            Go to the home page
          </Button>
        }
      />
    </Page>
  );
}
