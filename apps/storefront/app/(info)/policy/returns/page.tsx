import type { Metadata } from 'next';
import { DraftNotice, InfoPage, InfoSection } from '../../../../components/layout/InfoPage';

export const metadata: Metadata = {
  title: 'Return policy',
  description: 'How to return or exchange a miiday order, and what the return window covers.',
  alternates: { canonical: '/policy/returns' },
};

export default function ReturnPolicyPage() {
  return (
    <InfoPage
      eyebrow="Policies"
      title="Return policy"
      intro="What can be returned, in what window, and how a refund is issued."
    >
      <DraftNotice>
        The windows, exclusions and who pays return shipping below are placeholders reflecting a common setup — they
        are not the client&apos;s confirmed terms. Confirm each one before launch, and note that refunds are
        currently processed manually rather than automatically through the payment gateway.
      </DraftNotice>

      <InfoSection heading="Return window">
        <p>
          Most items can be returned within 7 days of delivery, unused and in their original packaging. The window
          runs from the delivery date shown on your order.
        </p>
      </InfoSection>

      <InfoSection heading="What cannot be returned">
        <p>
          Items that have been used or washed, anything sold as final sale, and personal-care or intimate goods
          cannot be returned for hygiene reasons. Damage caused after delivery is not covered.
        </p>
      </InfoSection>

      <InfoSection heading="Damaged or wrong items">
        <p>
          If something arrives damaged or is not what you ordered, tell us within 48 hours of delivery with a photo
          and we will arrange a replacement or a full refund, including shipping. This is separate from the ordinary
          return window.
        </p>
      </InfoSection>

      <InfoSection heading="How to start a return">
        <p>
          Email us with your order number and what you would like to return. We will confirm whether the item is
          eligible and send return instructions — please do not ship anything back before that, as unannounced
          returns cannot be matched to an order.
        </p>
      </InfoSection>

      <InfoSection heading="Refunds">
        <p>
          Once a return is received and checked, the refund is issued to the original payment method. Card, UPI and
          net-banking refunds are processed by our payment provider and typically take 5–7 working days to appear.
          Cash-on-delivery orders are refunded by bank transfer.
        </p>
      </InfoSection>

      <InfoSection heading="Cancellations">
        <p>
          An order can be cancelled from your order history while it is still pending or confirmed. After it has
          been packed, a return is the route instead.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
