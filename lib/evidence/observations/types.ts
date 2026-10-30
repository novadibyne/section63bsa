// File observations: facts read from a file that an examiner may want to look at. They are never conclusions:
// no rule says a file is genuine, altered, fake or AI-generated. See docs/SPECIFICATION.md §3.18.

/** Bump when a rule's logic or wording changes; printed with every observation. */
export const OBSERVATION_RULES_VERSION = '1.0';

/**
 * - noted: the check found something, quoted in `finding`.
 * - none: the check ran and found nothing to note. This never means the file is unaltered.
 * - unavailable: the check could not run on this file (format, size, or missing data).
 */
export type ObservationStatus = 'noted' | 'none' | 'unavailable';

export interface Observation {
  /** Stable rule id, e.g. "image.software". */
  id: string;
  /** What was checked. */
  check: string;
  status: ObservationStatus;
  /** What the file contains, quoting its values. */
  finding: string;
  /** What this can mean, and what it cannot show. */
  note: string;
  /** How the check was done, so an examiner can repeat it with other tools. */
  method: string;
}

export interface FileObservations {
  rules: string;
  checkedAt: string;
  items: Observation[];
  /** 64-bit perceptual hash (16 hex digits) of a picture, to find near-duplicates in the same record. */
  phash?: string;
  /** Camera make and model named in a picture, compared with the device described in step 2. */
  camera?: { make?: string; model?: string };
}

export const STATUS_LABEL: Record<ObservationStatus, string> = {
  noted: 'Noted',
  none: 'Nothing noted',
  unavailable: 'Not checked',
};

/** Shown above the observations in the app and on every page of the PDF annexure. */
export const OBSERVATIONS_NOTICE =
  'Generated automatically by software from the file’s own data. Informational only. Not part of the certificate under Section 63(4) of the Bharatiya Sakshya Adhiniyam, 2023, not an expert opinion under Section 39, and not a finding that any file is genuine or altered. To be assessed by a qualified examiner. The absence of an observation does not show that a file is unaltered.';

