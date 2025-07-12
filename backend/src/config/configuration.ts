export default () => ({
  port: parseInt(process.env.PORT || '4000', 10),
  frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'https://food-orderingV1.vercel.app', // Example

  omise: {
    publicKey: process.env.OMISE_PUBLIC_KEY,
    secretKey: process.env.OMISE_SECRET_KEY,
    webhookSecret: process.env.OMISE_WEBHOOK_SECRET,
    apiVersion: process.env.OMISE_API_VERSION || '2019-05-29',
  },
});