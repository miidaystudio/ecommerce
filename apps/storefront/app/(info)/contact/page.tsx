import type { Metadata } from 'next';
import { InfoPage, InfoSection } from '../../../components/layout/InfoPage';
import { settingsApi } from '../../../lib/api/settings.api';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'How to reach miiday about an order, a return or a product question.',
  alternates: { canonical: '/contact' },
};

// Contact details are admin-editable, so this page reads them rather than
// hardcoding anything that would go stale.
export const revalidate = 300;

export default async function ContactPage() {
  let supportEmail: string | null = null;
  let supportPhone: string | null = null;
  let addressLine: string | null = null;
  let storeName = 'miiday';

  try {
    const settings = await settingsApi.getPublic();
    supportEmail = settings.supportEmail;
    supportPhone = settings.supportPhone;
    addressLine = settings.addressLine;
    storeName = settings.storeName;
  } catch {
    // Rendered without the details rather than not at all.
  }

  return (
    <InfoPage
      eyebrow="Contact"
      title="Get in touch"
      intro={`Questions about an order, a return or a product all reach the same place at ${storeName}, and a person answers them.`}
    >
      <InfoSection heading="Email">
        {supportEmail ? (
          <p>
            <a href={`mailto:${supportEmail}`} className="text-primary underline hover:text-primary-hover">
              {supportEmail}
            </a>
            <span className="mt-1 block text-xs">
              Usually answered within one working day. Include your order number if you have one — it is on your
              confirmation email and in your order history.
            </span>
          </p>
        ) : (
          <p>Email details are being updated. Please try again shortly.</p>
        )}
      </InfoSection>

      {supportPhone ? (
        <InfoSection heading="Phone">
          <p>
            <a href={`tel:${supportPhone.replace(/\s+/g, '')}`} className="text-primary underline hover:text-primary-hover">
              {supportPhone}
            </a>
            <span className="mt-1 block text-xs">Monday to Friday, business hours.</span>
          </p>
        </InfoSection>
      ) : null}

      {addressLine ? (
        <InfoSection heading="Address">
          <p>{addressLine}</p>
          <p className="text-xs">
            This is our business address, not a returns address — a return has to be requested first so we can send
            you the right instructions.
          </p>
        </InfoSection>
      ) : null}

      <InfoSection heading="Before you write about an order">
        <p>
          Your order history shows the current status of every order, including whether it has shipped. If the
          status already answers your question, that is the fastest route.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
