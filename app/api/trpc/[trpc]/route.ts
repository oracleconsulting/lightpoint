import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/lib/trpc/router';

// Increase timeout for letter generation (three-stage pipeline can take 60-120s)
export const maxDuration = 300; // 5 minutes (Railway/Vercel allow up to 300s)
export const dynamic = 'force-dynamic'; // Disable static optimization

const handler = (req: Request) => {
  console.log('🔵 tRPC request received:', req.url);
  
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => ({}),
    onError: ({ error, path }) => {
      console.error('❌ tRPC Error on path:', path);
      console.error('Error details:', error);
    },
  });
};

export { handler as GET, handler as POST };

