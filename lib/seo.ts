// What search engines and link previews see: titles, descriptions, structured data and the questions people ask.
import type { Metadata } from 'next';
import { APP_NAME, CONTACT_EMAIL, SITE_URL } from '@/lib/config';

export const SEO_TITLE = `Section 63 BSA Certificate Generator | ${APP_NAME}`;
export const SEO_DESCRIPTION =
  'Free Section 63 BSA certificate generator: make Part A, Part B and the SHA-256 hash report for electronic evidence (formerly the 65B certificate). Nothing is uploaded.';
export const SEO_KEYWORDS = [
  'Section 63 BSA certificate',
  'Section 63 certificate',
  'Section 63(4) certificate',
  'Section 63 Bharatiya Sakshya Adhiniyam',
  'BSA certificate format',
  'Bharatiya Sakshya Adhiniyam certificate',
  'certificate for electronic evidence',
  'Section 65B certificate',
  '65B certificate',
  'hash value certificate',
  'SHA-256 hash report',
  'WhatsApp chat evidence certificate',
  'Part A Part B certificate',
];
export const OG_IMAGE = { url: '/og-image.png', width: 1200, height: 630, alt: `${APP_NAME}: Section 63 BSA certificate generator` };

/** Title, description, canonical address and link preview for one page. `index: false` keeps it out of search results. */
export function pageMetadata({
  title,
  description = SEO_DESCRIPTION,
  path,
  index = true,
}: {
  title: string;
  description?: string;
  path: string;
  index?: boolean;
}): Metadata {
  // The full title is set here, not through the layout's "%s | name" template, which a nested layout would cut off.
  const fullTitle = { absolute: path === '/' ? title : `${title} | ${APP_NAME}` };
  if (!index) return { title: fullTitle, robots: { index: false, follow: true } };
  return {
    title: fullTitle,
    robots: { index: true, follow: true },
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: APP_NAME, locale: 'en_IN', url: path, title, description, images: [OG_IMAGE] },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE.url] },
  };
}

/** Questions people search for, answered on the home page and marked up for search engines. */
export const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is a Section 63 BSA certificate?',
    a: 'Section 63(4) of the Bharatiya Sakshya Adhiniyam, 2023 says a copy of electronic evidence, such as a printout, screenshot or export, must come with a certificate in the format given in the Schedule every time it is submitted. It has Part A, signed by the party, and Part B, signed by an expert, and states the hash value of the record.',
  },
  {
    q: 'Is it the same as the Section 65B certificate?',
    a: 'It replaces it. The Section 65B certificate under the Indian Evidence Act, 1872 was held mandatory in Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal (2020). Since 1 July 2024 the Bharatiya Sakshya Adhiniyam applies, and Section 63 and its Schedule set the format.',
  },
  {
    q: 'Who signs Part A and Part B?',
    a: `Part A is signed by the person in charge of the device or of the relevant activities, usually the person producing the evidence. Part B is signed by an expert. ${APP_NAME} fills in both parts; the signatures are added on paper.`,
  },
  {
    q: 'What is the hash value and how is it calculated?',
    a: `A hash value is a fingerprint of a file: any change to the file changes it. The Schedule asks for the hash value and the algorithm used. ${APP_NAME} calculates the SHA-256 hash in your browser, and anyone can check it with sha256sum, shasum -a 256 or certutil.`,
  },
  {
    q: 'Can I make a certificate for WhatsApp chats, screenshots, emails or CCTV footage?',
    a: 'Yes. Any file works: WhatsApp chat exports, screenshots, photos, call and audio recordings, videos, PDFs and emails. The phone’s IMEI and serial numbers can be read from a photo.',
  },
  {
    q: 'Is my evidence uploaded anywhere?',
    a: 'No. Files and the details you type stay in your browser on your own device, and the app works offline. Only usage statistics are sent (pages opened, PDFs made, IP address and approximate location), never evidence or anything you type.',
  },
  {
    q: 'Is it free?',
    a: `Yes. ${APP_NAME} is free, needs no account, and works on Android phones, iPhones and computers.`,
  },
];

/** Structured data for the whole site: the site, who runs it, and the app itself. */
export const SITE_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: APP_NAME,
    alternateName: ['LegalHashed', 'Legal Hashed: Section 63 BSA certificate generator'],
    url: `${SITE_URL}/`,
    inLanguage: 'en-IN',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: APP_NAME,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/icons/icon-512.png`,
    email: CONTACT_EMAIL,
    contactPoint: { '@type': 'ContactPoint', email: CONTACT_EMAIL, contactType: 'customer support', availableLanguage: 'English' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `${APP_NAME}: Section 63 BSA certificate generator`,
    url: `${SITE_URL}/`,
    description: SEO_DESCRIPTION,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any (runs in a web browser)',
    browserRequirements: 'A current version of Chrome, Edge, Firefox or Safari',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
    inLanguage: 'en-IN',
    image: `${SITE_URL}${OG_IMAGE.url}`,
    featureList: [
      'Section 63(4) BSA certificate: Part A, Part B or both',
      'SHA-256 hash report for every file, calculated in the browser',
      'IMEI and serial numbers read from a photo',
      'Works offline; evidence is never uploaded',
    ],
    about: { '@type': 'Legislation', name: 'Bharatiya Sakshya Adhiniyam, 2023', legislationIdentifier: 'Act No. 47 of 2023' },
  },
];

export const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
};
