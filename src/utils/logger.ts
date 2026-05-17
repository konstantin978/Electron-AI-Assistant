const truncate = (text: string, max = 200): string =>
  text.length > max ? `${text.slice(0, max)}...` : text;

export const log = {
  info: (msg: string): void => console.log(msg),

  warn: (msg: string): void => console.warn(`⚠️  ${msg}`),

  error: (msg: string): void => console.error(`❌ ${msg}`),

  tool: (name: string, args: unknown): void =>
    console.log(`🔧 [tool] ${name}(${JSON.stringify(args)})`),

  toolResult: (result: string): void =>
    console.log(`   ↳ ${truncate(result).replace(/\n/g, " ")}`),
};
