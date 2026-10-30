// Word, Excel and PowerPoint files (.docx, .xlsx, .pptx): the properties they keep and leftover changes and comments.
import { formatIst } from '@/lib/time';
import { quote } from './bytes';
import type { Observation } from './types';

export interface OfficeParts {
  core?: string;
  app?: string;
  /** word/document.xml, for tracked insertions and deletions. */
  document?: string;
  /** Number of comments in the comment parts (Word, Excel, PowerPoint). */
  comments: number;
}

const tag = (xml: string | undefined, name: string) => {
  const m = xml && new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`).exec(xml);
  return m ? m[1].trim() || undefined : undefined;
};
const date = (v: string | undefined) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v) : undefined);

const METHOD =
  'Read docProps/core.xml and docProps/app.xml inside the file, and counted tracked changes (w:ins, w:del) and comments. Repeat by opening the file as a .zip, or with: exiftool <file>.';

export function officeProperties(p: OfficeParts): Observation {
  const base = { id: 'office.properties', check: 'Who wrote and last saved it, and its editing record', method: METHOD };
  if (!p.core && !p.app) {
    return { ...base, status: 'unavailable', finding: 'The file keeps no document properties.', note: 'They can be removed with “Inspect document” or similar tools.' };
  }
  const creator = tag(p.core, 'dc:creator');
  const lastBy = tag(p.core, 'cp:lastModifiedBy');
  const created = date(tag(p.core, 'dcterms:created'));
  const modified = date(tag(p.core, 'dcterms:modified'));
  const revision = Number(tag(p.core, 'cp:revision')) || undefined;
  const minutes = Number(tag(p.app, 'TotalTime')) || 0;
  const application = [tag(p.app, 'Application'), tag(p.app, 'AppVersion')].filter(Boolean).join(' ');
  const facts = [
    creator && `written by ${quote(creator)}`,
    lastBy && `last saved by ${quote(lastBy)}`,
    created && `created ${formatIst(created)}`,
    modified && `last changed ${formatIst(modified)}`,
    revision && `revision number ${revision}`,
    minutes && `${minutes} minute${minutes === 1 ? '' : 's'} of recorded editing time`,
    application && `saved with ${quote(application)}`,
  ].filter(Boolean);
  const differentPeople = !!creator && !!lastBy && creator !== lastBy;
  const changedLater = !!created && !!modified && Math.abs(modified.getTime() - created.getTime()) > 60_000;
  return {
    ...base,
    status: differentPeople || changedLater || (revision ?? 1) > 1 ? 'noted' : 'none',
    finding: facts.length ? `The file’s properties record: ${facts.join('; ')}.` : 'The file’s properties are empty.',
    note: 'Office programs fill these in from the user name set in the program and the computer’s clock, and update them on every save. Anyone can change them, so they show how the file was handled, not who wrote its content.',
  };
}

export function officeChanges(p: OfficeParts): Observation {
  const base = { id: 'office.changes', check: 'Tracked changes and comments left in the file', method: METHOD };
  const ins = (p.document?.match(/<w:ins\b/g) ?? []).length;
  const del = (p.document?.match(/<w:del\b/g) ?? []).length;
  if (ins || del || p.comments) {
    const facts = [
      ins && `${ins} tracked insertion${ins === 1 ? '' : 's'}`,
      del && `${del} tracked deletion${del === 1 ? '' : 's'}`,
      p.comments && `${p.comments} comment${p.comments === 1 ? '' : 's'}`,
    ].filter(Boolean);
    return {
      ...base,
      status: 'noted',
      finding: `The file still contains ${facts.join(', ')}.`,
      note: 'Tracked changes and comments record earlier wording and who suggested it. They may be hidden when the file is printed or viewed normally.',
    };
  }
  return { ...base, status: 'none', finding: 'The file contains no tracked changes or comments.', note: 'Accepting changes or deleting comments removes them without trace.' };
}

/** Reads the parts the rules need from a .docx, .xlsx or .pptx file. */
export async function officeParts(file: Blob): Promise<OfficeParts> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(file);
  const read = (name: string) => zip.file(name)?.async('string');
  let comments = 0;
  for (const name of Object.keys(zip.files)) {
    if (/^word\/comments\.xml$/.test(name)) comments += ((await read(name))?.match(/<w:comment\b/g) ?? []).length;
    else if (/^xl\/comments\d*\.xml$/.test(name)) comments += ((await read(name))?.match(/<comment\b/g) ?? []).length;
    else if (/^ppt\/comments\/.+\.xml$/.test(name)) comments += ((await read(name))?.match(/<p(?:188)?:cm\b/g) ?? []).length;
  }
  return { core: await read('docProps/core.xml'), app: await read('docProps/app.xml'), document: await read('word/document.xml'), comments };
}
