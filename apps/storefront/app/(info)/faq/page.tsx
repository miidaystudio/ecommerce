import type { Metadata } from 'next';
import { InfoPage, InfoSection } from '../../../components/layout/InfoPage';
import { settingsApi } from '../../../lib/api/settings.api';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers to common questions about miiday delivery, payment, returns and order tracking.',
  alternates: { canonical: '/faq' },
};

// Shipping numbers come from store settings so this page can never contradict
// what checkout actually charges.
export const revalidate = 300;

export default async function FaqPage() {
  let freeShippingThreshold = 999;
  let flatShippingFee = 79;
  try {
    const settings = await settingsApi.getPublic();
    freeShippingThreshold = settings.freeShippingThreshold;
    flatShippingFee = settings.flatShippingFee;
  } catch {
    // Fall back to the documented defaults rather than failing the page.
  }

  const money = (value: number) => `₹${value.toLocaleString('en-IN')}`;

  return (
    <InfoPage
      eyebrow="Help"
      title="Frequently asked questions"
      intro="If your question isn't here, the contact page reaches a person."
    >
      <InfoSection heading="How much is delivery?">
        <p>
          Delivery is {money(flatShippingFee)} on orders below {money(freeShippingThreshold)}, and free at or above
          that. The exact figure is always shown on the order summary before you pay.
        </p>
      </InfoSection>

      <InfoSection heading="Which payment methods can I use?">
        <p>
          Cards, UPI, net banking and wallets are handled by Razorpay, our payment provider. Cash on delivery is
          available as well. We never see or store your card details.
        </p>
      </InfoSection>

      <InfoSection heading="Can I use a discount code?">
        <p>
          Yes — enter it in the coupon field on the checkout page and the discount is applied to your order summary
          before you pay. One code per order.
        </p>
      </InfoSection>

      <InfoSection heading="How do I track my order?">
        <p>
          Every order appears under your account as soon as it is placed, with its current status. You will also get
          an email when it is confirmed, shipped and delivered.
        </p>
      </InfoSection>

      <InfoSection heading="Can I cancel an order?">
        <p>
          You can cancel from your order history while the order is still pending or confirmed. Once it has been
          packed and handed over for shipping, a return is the way to send it back.
        </p>
      </InfoSection>

      <InfoSection heading="Do I need an account to buy?">
        <p>
          Yes, for now. An account is what lets you track an order, save addresses and request a return. Guest
          checkout is not available yet.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
