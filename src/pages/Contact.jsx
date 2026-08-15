import { Page } from '../components/Layout';
import { Button, Card, DetailRow, PageHeader } from '../components/UI';
import { BRAND } from '../lib/constants';

export default function Contact() {
  const phoneDigits = BRAND.phone.replace(/\D/g, '');

  return (
    <Page>
      <PageHeader
        title="Contact Us"
        subtitle="Real people, local to your neighborhood."
        back="/"
      />

      <Card>
        <DetailRow label="Business" value={BRAND.name} />
        <DetailRow label="Phone" value={<a href={`tel:${phoneDigits}`}>{BRAND.phone}</a>} />
        <DetailRow label="Email" value={<a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>} />
        <DetailRow label="Hours" value="Mon–Sat, 8 AM – 8 PM" />
      </Card>

      <div className="stack" style={{ marginTop: 16 }}>
        <Button href={`tel:${phoneDigits}`} size="lg" full>
          CALL US
        </Button>
        <Button href={`mailto:${BRAND.email}`} variant="secondary" full>
          Send an Email
        </Button>
        <Button as="link" to="/signup" variant="ghost" full>
          Request a free lawn consultation instead
        </Button>
      </div>
    </Page>
  );
}
