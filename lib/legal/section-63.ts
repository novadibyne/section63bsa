/** Section 63, Bharatiya Sakshya Adhiniyam, 2023: text shown in the in-app help panel. */

export const SECTION_63_4 = `(4) In any proceeding where it is desired to give a statement in evidence by virtue of this section, a certificate doing any of the following things shall be submitted along with the electronic record at each instance where it is being submitted for admission, namely:—
(a) identifying the electronic record containing the statement and describing the manner in which it was produced;
(b) giving such particulars of any device involved in the production of that electronic record as may be appropriate for the purpose of showing that the electronic record was produced by a computer or a communication device referred to in clauses (a) to (e) of sub-section (3);
(c) dealing with any of the matters to which the conditions mentioned in sub-section (2) relate,
and purporting to be signed by a person in charge of the computer or communication device or the management of the relevant activities (whichever is appropriate) and an expert shall be evidence of any matter stated in the certificate; and for the purposes of this sub-section it shall be sufficient for a matter to be stated to the best of the knowledge and belief of the person stating it in the certificate specified in the Schedule.`;

/** Plain-language summaries (not statutory text). */
export const SECTION_63_GUIDE: { ref: string; summary: string }[] = [
  {
    ref: '63(1)',
    summary:
      'Computer output (printouts, copies, exports) is treated as a document and is admissible without producing the original, if the conditions in this section are met.',
  },
  {
    ref: '63(2)',
    summary:
      'Four conditions: the device was used regularly by the person in lawful control; the information was regularly fed in; the device worked properly (or any fault did not affect the record); and the record reproduces information fed in the ordinary course.',
  },
  {
    ref: '63(3)',
    summary:
      'Several devices used for the purpose (standalone, a computer system, a network, a computer resource or an intermediary) are treated as one device.',
  },
  {
    ref: '63(4)',
    summary:
      'A certificate in the Schedule format, signed by the person in charge and by an expert, must accompany the record every time it is submitted.',
  },
  {
    ref: '63(5)',
    summary: 'Information supplied or output produced with or without human intervention counts.',
  },
];

export const MANNER_EXAMPLES = [
  'Exported via WhatsApp › More › Export chat › Include media on the mobile phone described below',
  'Screenshots captured on the mobile phone described below using its built-in screenshot function',
  'CCTV footage exported from the DVR described below to a USB flash drive using the DVR’s export menu',
  'Call recording copied from the phone’s internal storage to a computer over USB',
  'Email downloaded as an .eml file from the mailbox described below',
];
