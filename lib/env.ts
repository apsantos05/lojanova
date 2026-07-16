function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

export function serverEnv() {
  const blackcatBaseUrl = process.env.BLACKCAT_BASE_URL?.trim() || 'https://api.blackcatoficial.com/api';
  if (!blackcatBaseUrl.startsWith('https://')) throw new Error('BLACKCAT_BASE_URL deve usar HTTPS.');
  return {
    blackcatBaseUrl: blackcatBaseUrl.replace(/\/+$/, ''),
    blackcatSecretKey: required('BLACKCAT_SECRET_KEY'),
    appUrl: required('NEXT_PUBLIC_APP_URL').replace(/\/+$/, ''),
    supabaseUrl: required('SUPABASE_URL'),
    supabaseSecretKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    pdfBucket: process.env.SUPABASE_PDF_BUCKET?.trim() || 'protected-content',
    pdfObject: process.env.SUPABASE_PDF_OBJECT?.trim() || 'oracao-sao-bento-guia-7-dias.pdf',
    tiktokPixelId: process.env.TIKTOK_PIXEL_ID?.trim() || '',
    tiktokAccessToken: process.env.TIKTOK_ACCESS_TOKEN?.trim() || '',
  };
}
