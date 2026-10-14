// Local tsc compatibility only. Deployment uses Deno's native declarations.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
