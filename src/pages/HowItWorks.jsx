import { Page } from '../components/Layout';
import { Button, Card, PageHeader } from '../components/UI';
import { BRAND } from '../lib/constants';

export default function HowItWorks() {
  return (
    <Page>
      <PageHeader
        title="How It Works"
        subtitle="Four steps from scanning a door hanger to a freshly cut lawn."
        back="/"
      />

      <Card>
        <ol className="steps">
          <li>
            <strong>Request a free consultation</strong>
            Tell us your address and when you are around. It costs nothing and
            you are not signing up for anything.
          </li>
          <li>
            <strong>We look at your lawn</strong>
            We walk the property, note the gates, gardens, pets and anything
            that should not be mowed, and set a fair flat price per mow.
          </li>
          <li>
            <strong>You see your price</strong>
            Your price shows up in your account. From then on, booking a mow is
            one button — no texting back and forth.
          </li>
          <li>
            <strong>We mow, then you pay</strong>
            Pick a day and a time window that works. You will see when the mow
            is scheduled, started and finished, and you pay after the work is
            done.
          </li>
        </ol>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <h3>Why the free consultation first?</h3>
        <p className="muted small">
          Every lawn is different. Looking at it in person means we can quote
          one honest price instead of guessing, and we learn the details that
          matter — where the gate latch is, which corner was just seeded, which
          dog is friendly. Those notes get saved to your property and go to
          every mower who ever works on your lawn.
        </p>
      </Card>

      <div className="stack" style={{ marginTop: 20 }}>
        <Button as="link" to="/signup" size="lg" full>
          REQUEST A FREE LAWN CONSULTATION
        </Button>
        <Button as="link" to="/contact" variant="ghost" full>
          Questions? Contact {BRAND.name}
        </Button>
      </div>
    </Page>
  );
}
