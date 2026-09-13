import type { Metadata } from 'next';
import { DraftNotice, InfoPage, InfoSection } from '../../../../components/layout/InfoPage';

export const metadata: Metadata = {
  title: 'Terms of service',
  description: 'The terms that apply when you browse or buy from miiday.',
  alternates: { canonical: '/policy/terms' },
};

export default function TermsPage() {
  return (
    <InfoPage
      eyebrow="Policies"
      title="Terms of service"
      intro="These terms apply whenever you browse or buy from this store."
    >
      <DraftNotice>
        This is a structural draft, not legal advice or the client&apos;s confirmed terms. It needs review by
        someone qualified — governing law, liability limits and dispute resolution in particular — before the store
        goes live.
      </DraftNotice>

      <InfoSection heading="Using this store">
        <p>
          You may browse freely. Placing an order requires an account, and you are responsible for keeping your
          sign-in details private and for activity under your account.
        </p>
      </InfoSection>

      <InfoSection heading="Products, prices and availability">
        <p>
          Prices and availability are as shown at the moment you check out, and are re-checked by our systems when
          your order is placed. Where a listing is wrong or an item sells out between adding it to your cart and
          paying, we will tell you and cancel or refund rather than charge you for something we cannot supply.
        </p>
      </InfoSection>

      <InfoSection heading="Orders and acceptance">
        <p>
          An order is an offer to buy. It is accepted when we confirm it — which for prepaid orders is when payment
          is confirmed by our payment provider. We may decline an order, for example where we cannot fulfil it or
          where we suspect fraud.
        </p>
      </InfoSection>

      <InfoSection heading="Payment">
        <p>
          Payments are handled by Razorpay. Card and bank details are entered with them, not with us, and we do not
          store them. Cash on delivery is available on eligible orders.
        </p>
      </InfoSection>

      <InfoSection heading="Coupons and offers">
        <p>
          Discount codes are single-use per customer unless stated otherwise, cannot be combined, and may be
          withdrawn at any time. A code applies only to orders that meet its stated conditions.
        </p>
      </InfoSection>

      <InfoSection heading="Returns">
        <p>
          Returns and refunds are covered by our{' '}
          <a href="/policy/returns" className="text-primary underline hover:text-primary-hover">
            return policy
          </a>
          , which forms part of these terms.
        </p>
      </InfoSection>

      <InfoSection heading="Content and reviews">
        <p>
          Reviews you submit are checked before publication, and we may decline or remove any that are abusive,
          off-topic or not about the product. By posting one you allow us to display it alongside the product.
        </p>
      </InfoSection>

      <InfoSection heading="Changes to these terms">
        <p>
          We may update these terms; the version in force is the one published here when you place your order.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
