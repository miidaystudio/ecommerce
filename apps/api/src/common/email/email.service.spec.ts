import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

describe('EmailService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function createService(apiKey: string | undefined, fromEmail = 'miiday <onboarding@resend.dev>') {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'RESEND_API_KEY') return apiKey;
        if (key === 'RESEND_FROM_EMAIL') return fromEmail;
        return undefined;
      }),
    } as unknown as ConfigService;
    return new EmailService(config);
  }

  it('masks the 4-digit code and logs when api key is a placeholder', async () => {
    const service = createService('re_placeholder_key');
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    await service.sendOtpEmail('test@example.com', '1234');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    const loggedMessage = logSpy.mock.calls[0][0];
    expect(loggedMessage).toContain('test@example.com');
    expect(loggedMessage).toContain('****');
    expect(loggedMessage).not.toContain('1234');
  });

  it('masks the 4-digit code when api key is unset', async () => {
    const service = createService(undefined);
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    await service.sendOtpEmail('user@test.com', '9876');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).not.toContain('9876');
    expect(logSpy.mock.calls[0][0]).toContain('****');
  });

  it('dispatches to Resend API when a live key is configured', async () => {
    const service = createService('re_live_valid_key_123');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'email_123' }),
    });
    global.fetch = fetchMock;

    await service.sendOtpEmail('buyer@miiday.com', '5678');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.method).toBe('POST');
    expect(options.headers['Authorization']).toBe('Bearer re_live_valid_key_123');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.to).toEqual(['buyer@miiday.com']);
    expect(body.subject).toBe('WELCOME TO MIIDAY, your one-time-password is 5678');
    expect(body.text).toContain('5678');
    expect(body.html).toContain('5678');
    expect(body.html).toContain('miiday');
    expect(body.html).toContain('#FAF9F6');
  });

  it('refuses to fake-send an OTP in production when no live key is configured', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const service = createService('re_placeholder_key');
    global.fetch = jest.fn();
    try {
      await expect(service.sendOtpEmail('a@b.com', '1234')).rejects.toThrow('RESEND_API_KEY');
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it('throws on a Resend error without logging the response body, which can echo the code', async () => {
    const service = createService('re_live_valid_key_123');
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 422, text: async () => 'subject: ... is 4321' });

    await expect(service.sendOtpEmail('a@b.com', '4321')).rejects.toThrow('HTTP 422');
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('4321');
  });

  it('keeps ordinary notifications best-effort: send() never throws', async () => {
    const service = createService('re_live_valid_key_123');
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    await expect(service.send({ to: 'a@b.com', subject: 'Order confirmed', body: 'x' })).resolves.toBeUndefined();
  });
});
