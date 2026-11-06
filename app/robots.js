// Dashboard privat: interzis tuturor crawlerelor (inclusiv AI).
export default function robots() {
  return { rules: [{ userAgent: '*', disallow: '/' }] }
}
