import type { Metadata } from 'next';
import { InfoPage, InfoSection } from '../../../components/layout/InfoPage';

export const metadata: Metadata = {
  title: 'About',
  description:
    'How miiday chooses what it sells — a small, considered range for a slower home, across multiple categories.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <InfoPage
      eyebrow="About"
      title="A slower kind of home shop"
      intro="miiday is a single-owner shop, not a marketplace. Everything listed here is chosen, stocked and shipped by us."
    >
      <InfoSection heading="What we sell">
        <p>
          A deliberately small range across several categories for the home — textiles, tableware, storage and the
          quiet everyday objects that sit between them. We would rather carry fifty things worth keeping than five
          thousand that are merely available.
        </p>
      </InfoSection>

      <InfoSection heading="How we choose it">
        <p>
          Every product has to earn its place on three counts: it has to be well made, it has to be repairable or
          long-lived, and it has to be something we would put in our own homes. If a product stops meeting those,
          we stop selling it rather than discounting it forever.
        </p>
      </InfoSection>

      <InfoSection heading="Getting in touch">
        <p>
          Orders, returns and product questions all go to the same place, and a person answers them. The{' '}
          <a href="/contact" className="text-primary underline hover:text-primary-hover">
            contact page
          </a>{' '}
          has the details.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
