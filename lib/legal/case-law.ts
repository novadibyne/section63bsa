/**
 * How the electronic-evidence certificate came to be, in plain words. Shown on the Why it matters page (/why/).
 * These are summaries for orientation, not statutory text or legal advice; the judgments themselves control.
 */

export interface Milestone {
  year: string;
  /** Exact date where it matters to the reader. */
  date?: string;
  title: string;
  citation?: string;
  kind: 'law' | 'judgment';
  /** One line for the compact column. */
  short: string;
  /** A fuller, still plain-language summary. */
  summary: string;
  /** Turning points are highlighted. */
  key?: boolean;
}

export const CERTIFICATE_HISTORY: Milestone[] = [
  {
    year: '2000',
    date: '17 October 2000',
    title: 'Information Technology Act adds Section 65B to the Evidence Act',
    citation: 'Act 21 of 2000',
    kind: 'law',
    short: 'Copies of electronic records can be used in court, with a certificate.',
    summary:
      'Printouts and copies of electronic records become admissible as documents, if the conditions in s.65B are met. Section 65B(4) provides for a certificate that identifies the record, describes how it was produced and gives details of the device.',
  },
  {
    year: '2014',
    title: 'Anvar P.V. v. P.K. Basheer',
    citation: '(2014) 10 SCC 473',
    kind: 'judgment',
    short: 'Supreme Court: no certificate, no copy of electronic evidence.',
    summary:
      'A three-judge bench holds that a copy of an electronic record (a CD, a printout, a pen-drive copy) cannot be admitted as evidence unless the s.65B(4) certificate is produced with it.',
  },
  {
    year: '2018',
    title: 'Shafhi Mohammad v. State of Himachal Pradesh',
    citation: '(2018) 2 SCC 801',
    kind: 'judgment',
    short: 'A two-judge bench relaxes the rule.',
    summary:
      'A two-judge bench says the certificate is a procedural requirement that can be relaxed, for example when the party producing the record does not have the device it came from.',
  },
  {
    year: '2020',
    date: '14 July 2020',
    title: 'Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal',
    citation: '(2020) 7 SCC 1',
    kind: 'judgment',
    key: true,
    short: 'The certificate is mandatory. Shafhi Mohammad is overruled.',
    summary:
      'A three-judge bench settles the law. The certificate is a condition precedent: a copy of an electronic record is not admissible without it. Shafhi Mohammad is overruled. No certificate is needed only when the original device itself is produced and proved in court. If the certificate is missing, the court can allow or order it to be filed while the trial is still going on.',
  },
  {
    year: '2024',
    date: '1 July 2024',
    title: 'Bharatiya Sakshya Adhiniyam, 2023 — Section 63',
    citation: 'Act 47 of 2023',
    kind: 'law',
    key: true,
    short: 'The BSA keeps the rule and fixes the certificate’s format: Part A, Part B and the hash value.',
    summary:
      'The BSA replaces the Indian Evidence Act. Section 63 carries forward the certificate rule from s.65B and requires the certificate in the format given in the Schedule: Part A signed by the party in charge of the device, Part B signed by an expert, and the hash value of each record. A certificate is needed every time the record is submitted.',
  },
  {
    year: '2026',
    date: '22 May 2026',
    title: 'Pune Bar Association v. Union of India',
    citation: 'Supreme Court, three-judge bench',
    kind: 'judgment',
    key: true,
    short: 'Supreme Court upholds Section 63(4): the hash value is an “electronic fingerprint”.',
    summary:
      'The Supreme Court rejects a challenge to s.63(4) and the Schedule. It describes the hash value as an electronic fingerprint and the expert’s Part B as an extra layer of assurance. Part B is not limited to examiners notified under s.79A of the IT Act: a person with real expertise in computer science or cyber forensics may sign it, if the court is satisfied of that expertise.',
  },
];

/** What the history means for someone producing electronic evidence today. */
export const WHAT_IT_MEANS: string[] = [
  'Filing a screenshot, printout, chat export, recording or pen-drive copy? Attach a Section 63 certificate.',
  'Use the exact format in the Schedule: Part A by you (the person in charge of the device) and Part B by an expert.',
  'State the hash value of each file. It proves the copy has not been changed.',
  'File a fresh certificate each time the record is submitted.',
  'A certificate is not needed if you produce the original device itself in court. Ask your lawyer which applies.',
];
