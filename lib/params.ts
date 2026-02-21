import { z } from 'zod';

const providerSchema = z.enum(['google', 'apple', 'facebook', 'twitch']);
const modeSchema = z.enum(['popup', 'redirect']);

export const loginParamsSchema = z.object({
  client_id: z.string().min(1, 'client_id is required'),
  redirect_uri: z.string().url('redirect_uri must be a valid URL'),
  state: z.string().min(1, 'state is required'),
  nonce: z.string().min(1, 'nonce is required'),
  return_origin: z.string().min(1, 'return_origin is required'),
  mode: modeSchema,
  provider: providerSchema,
  code_challenge: z.string().min(1, 'code_challenge is required'),
  code_challenge_method: z.literal('S256'),
  request_id: z.string().optional(),
});

export type LoginParams = z.infer<typeof loginParamsSchema>;
export type AuthProvider = z.infer<typeof providerSchema>;
export type AuthMode = z.infer<typeof modeSchema>;

export function parseLoginParams(
  searchParams: URLSearchParams | Record<string, string>
): {
  success: true;
  params: LoginParams;
} | {
  success: false;
  error: string;
} {
  const raw: Record<string, string> =
    searchParams instanceof URLSearchParams
      ? Object.fromEntries(searchParams.entries())
      : searchParams;

  const result = loginParamsSchema.safeParse(raw);
  if (result.success) {
    return { success: true, params: result.data };
  }

  const firstIssue = result.error.issues[0];
  const message = firstIssue
    ? `${firstIssue.path.join('.')}: ${firstIssue.message}`
    : 'Invalid parameters';
  return { success: false, error: message };
}
