import Image from 'next/image';
import Link from 'next/link';
import type { BannerView } from '@ecommerce/shared-types';
import { resolveImageUrl } from '../../lib/utils/image-url';
import { safeUrl } from '../../lib/utils/safe-url';

const SHELL =
  'group relative aspect-[16/9] overflow-hidden rounded-lg border border-border bg-surface md:aspect-[21/9]';

function BannerBody({ banner, imageUrl }: { banner: BannerView; imageUrl: string | null }) {
  return (
    <>
      {imageUrl ? (
        <Image
          src={resolveImageUrl(imageUrl)}
          alt=""
          fill
          // Full width on phones, half the 1152px container from md up.
          sizes="(max-width: 768px) 100vw, 576px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
      ) : null}
      <div
        className={`relative flex h-full flex-col justify-end p-6 ${
          imageUrl ? 'bg-gradient-to-t from-text-primary/70 to-transparent' : 'bg-surface'
        }`}
      >
        <h3 className={`text-lg font-semibold tracking-tight ${imageUrl ? 'text-primary-foreground' : 'text-text-primary'}`}>
          {banner.title}
        </h3>
        {banner.subtitle ? (
          <p className={`mt-1 text-sm ${imageUrl ? 'text-primary-foreground/80' : 'text-text-secondary'}`}>
            {banner.subtitle}
          </p>
        ) : null}
      </div>
    </>
  );
}

export function HomeBanners({ banners }: { banners: BannerView[] }) {
  if (banners.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-16">
      <div className={`grid gap-5 ${banners.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
        {banners.map((banner) => {
          const imageUrl = safeUrl(banner.imageUrl);
          const linkUrl = safeUrl(banner.linkUrl);

          return linkUrl ? (
            <Link key={banner.id} href={linkUrl} className={SHELL}>
              <BannerBody banner={banner} imageUrl={imageUrl} />
            </Link>
          ) : (
            <div key={banner.id} className={SHELL}>
              <BannerBody banner={banner} imageUrl={imageUrl} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
