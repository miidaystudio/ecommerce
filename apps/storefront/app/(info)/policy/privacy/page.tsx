import type { Metadata } from 'next';
import { DraftNotice, InfoPage, InfoSection } from '../../../../components/layout/InfoPage';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What data miiday collects, why, and how long it is kept.',
  alternates: { canonical: '/policy/privacy' },
};

export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Policies"
      title="Privacy policy"
      intro="What we collect, why we collect it, and what we do not do with it."
    >
      <DraftNotice>
        The categories below describe what this store&apos;s code actually collects, which makes them accurate as a
        starting point — but retention periods, the legal basis for processing and the final list of third-party
        processors still need the client&apos;s confirmation and a legal review before launch.
      </DraftNotice>

      <InfoSection heading="What we collect">
        <p>
          Your name, email address, phone number and delivery addresses, so we can take and deliver an order. Your
          order history, including what you bought and what you paid. Reviews you submit. If you contact us, the
          message you send.
        </p>
      </InfoSection>

      <InfoSection heading="What we do not hold">
        <p>
          Card numbers, UPI IDs and bank details are entered with our payment provider, Razorpay, and are never sent
          to or stored on our systems. We receive only a payment reference and whether it succeeded.
        </p>
      </InfoSection>

      <InfoSection heading="Why we use it">
        <p>
          To process and deliver your orders, to keep you updated about them by email, to handle returns and support
          requests, and to keep the accounting records a business is required to keep.
        </p>
      </InfoSection>

      <InfoSection heading="Who else sees it">
        <p>
          Our payment provider, for payments. Our delivery partners, for the address on your parcel. Our email
          provider, to send order notifications. Each receives only what it needs for that purpose. We do not sell
          your data, and we do not share it for advertising.
        </p>
      </InfoSection>

      <InfoSection heading="Cookies and local storage">
        <p>
          A session cookie keeps you signed in. Your browser also stores your cart, wishlist and recently-viewed
          items locally so they survive a refresh — that data stays on your device. We do not use advertising
          trackers.
        </p>
      </InfoSection>

      <InfoSection heading="Your choices">
        <p>
          You can view and edit your details and addresses from your account, delete a review you have written, and
          ask us to close your account. Order records are kept even then, because they are financial records — but
          they stop being used for anything else.
        </p>
      </InfoSection>

      <InfoSection heading="Reaching us about privacy">
        <p>
          Privacy questions go to the address on our{' '}
          <a href="/contact" className="text-primary underline hover:text-primary-hover">
            contact page
          </a>
          .
        </p>
      </InfoSection>
    </InfoPage>
  );
}
