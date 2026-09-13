import { applyDecorators } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';

// A site-relative path ("/products?x=1") or an absolute http(s) URL — nothing
// else. This deliberately excludes javascript:, data: and vbscript: URLs,
// which would otherwise execute in a visitor's browser once rendered into an
// href/src, and protocol-relative "//evil.com" (and its "/\evil.com" variant)
// which browsers resolve as an external host.
const SAFE_URL_PATTERN = /^(?:\/(?![/\\])[^\s]*|https?:\/\/[^\s]+)$/;

export function IsSafeUrl(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    Matches(SAFE_URL_PATTERN, {
      message: 'Must be a path starting with "/" or an absolute http(s) URL',
    }),
  );
}

export { SAFE_URL_PATTERN };
