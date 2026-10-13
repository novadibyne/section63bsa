import { Document, Font, Page, Path, Svg, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import type { CertificateContext } from '@/lib/legal/certificate-values';
import { buildPartValues } from '@/lib/legal/certificate-values';
import {
  PART_A,
  PART_B,
  SCHEDULE_HEADING,
  BLANK,
  type Line,
  type PartValues,
  type SchedulePart,
  type Seg,
} from '@/lib/legal/schedule-63';
import { APP_NAME, HASH_WASM_VERSION } from '@/lib/config';
import { formatIst, formatIstSeconds } from '@/lib/time';
import { formatBytes } from '@/lib/utils';
import { KIND_LABEL } from '@/lib/evidence/detect';
import type { EvidenceFile } from '@/lib/types';

// Never hyphenate: hash values and identifiers must print exactly as computed.
Font.registerHyphenationCallback((word) => [word]);

const INK = '#0d1b3e';
const MUTED = '#5b6785';
const LINE = '#cfd5e2';

const s = StyleSheet.create({
  page: { paddingTop: 46, paddingBottom: 64, paddingHorizontal: 54, fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.42, color: INK },
  center: { textAlign: 'center' },
  heading1: { fontFamily: 'Helvetica-Bold', fontSize: 13, textAlign: 'center', letterSpacing: 1.5 },
  heading2: { fontSize: 10, textAlign: 'center', color: MUTED, marginTop: 2 },
  heading3: { fontFamily: 'Helvetica-Bold', fontSize: 12, textAlign: 'center', letterSpacing: 3, marginTop: 6 },
  partTitle: { fontFamily: 'Helvetica-Bold', fontSize: 12, textAlign: 'center', marginTop: 14, letterSpacing: 1 },
  partSub: { fontFamily: 'Helvetica-Oblique', fontSize: 10, textAlign: 'center', color: MUTED, marginBottom: 12 },
  para: { marginBottom: 7 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 2 },
  filled: { fontFamily: 'Helvetica-Bold' },
  hash: { fontFamily: 'Courier-Bold', fontSize: 9 },
  box: { width: 9.5, height: 9.5, borderWidth: 0.9, borderColor: INK, marginLeft: 4, marginRight: 14, alignItems: 'center', justifyContent: 'center' },
  sigWrap: { marginTop: 10, marginBottom: 6, alignSelf: 'flex-end', width: 230 },
  sigSpace: { height: 30 },
  sigLine: { borderBottomWidth: 0.8, borderBottomColor: INK, marginBottom: 3 },
  footerRule: { position: 'absolute', bottom: 54, left: 54, right: 54, borderTopWidth: 0.5, borderTopColor: LINE },
  footerText: { position: 'absolute', bottom: 24, left: 54, width: 360, fontSize: 7, color: MUTED, lineHeight: 1.35 },
  footerPage: { position: 'absolute', bottom: 24, right: 54, width: 110, textAlign: 'right', fontSize: 7, lineHeight: 1.35, color: MUTED },
  watermark: { position: 'absolute', top: 330, left: 0, right: 0, textAlign: 'center', fontFamily: 'Helvetica-Bold', fontSize: 120, color: INK, opacity: 0.055, transform: 'rotate(-32deg)', letterSpacing: 10 },
  annexTitle: { fontFamily: 'Helvetica-Bold', fontSize: 13, letterSpacing: 1 },
  annexSub: { fontSize: 9, color: MUTED, marginTop: 2, marginBottom: 14 },
  sectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, letterSpacing: 1.2, color: MUTED, marginTop: 14, marginBottom: 6 },
  kv: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 3.5 },
  k: { width: 118, color: MUTED, fontSize: 8.5 },
  v: { flex: 1, fontSize: 9.5 },
  fileCard: { borderWidth: 0.8, borderColor: LINE, borderRadius: 4, padding: 10, marginBottom: 10 },
  fileName: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginBottom: 6 },
  mono: { fontFamily: 'Courier', fontSize: 8.6 },
  memberRow: { paddingVertical: 2.5, borderBottomWidth: 0.4, borderBottomColor: LINE },
  small: { fontSize: 8.5, color: MUTED, lineHeight: 1.5 },
});

function Tick() {
  return (
    <Svg width={8} height={8} viewBox="0 0 10 10">
      <Path d="M1.5 5.2 L4 7.7 L8.6 2.4" stroke={INK} strokeWidth={1.6} fill="none" />
    </Svg>
  );
}

function SegText({ seg, values }: { seg: Seg; values: PartValues }) {
  if (typeof seg === 'string') return <Text>{seg}</Text>;
  if ('field' in seg) {
    const v = values.fields[seg.field]?.trim();
    if (!v) return <Text>{seg.blank ?? BLANK}</Text>;
    return (
      <Text>
        {seg.lead ?? ''}
        <Text style={seg.field === 'hashValues' ? s.hash : s.filled}>{v}</Text>
      </Text>
    );
  }
  if ('signature' in seg) return <Text>{seg.signature}</Text>;
  return null;
}

function LineView({ line, values }: { line: Line; values: PartValues }) {
  const sig = line.find((x) => typeof x === 'object' && 'signature' in x) as { signature: string } | undefined;
  if (sig) {
    return (
      <View style={s.sigWrap} wrap={false}>
        <View style={s.sigSpace} />
        <View style={s.sigLine} />
        {(values.signatureLines ?? []).map((l, i) => (
          <Text key={i} style={i === 0 ? s.filled : undefined}>
            {l}
          </Text>
        ))}
        <Text>{sig.signature}</Text>
      </View>
    );
  }
  const hasBox = line.some((x) => typeof x === 'object' && 'box' in x);
  if (!hasBox) {
    return (
      <Text>
        {line.map((seg, i) => (
          <SegText key={i} seg={seg} values={values} />
        ))}
      </Text>
    );
  }
  return (
    <View style={s.row}>
      {line.map((seg, i) => {
        if (typeof seg === 'object' && 'box' in seg) {
          const checked = values.boxes[seg.box].has(seg.key);
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text>{seg.label}</Text>
              <View style={s.box}>{checked ? <Tick /> : null}</View>
            </View>
          );
        }
        if (typeof seg === 'string' && !seg.trim()) return null;
        return <SegText key={i} seg={seg} values={values} />;
      })}
    </View>
  );
}

function PartView({ part, values }: { part: SchedulePart; values: PartValues }) {
  return (
    <View>
      <Text style={s.partTitle}>{part.title}</Text>
      <Text style={s.partSub}>{part.subtitle}</Text>
      {part.paragraphs.map((p, i) => (
        <View key={i} style={s.para} wrap={p.length < 6}>
          {p.map((line, j) => (
            <LineView key={j} line={line} values={values} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Footer({ ctx, section }: { ctx: CertificateContext; section: string }) {
  const stamp = formatIst(ctx.cert.finalisedAt ?? new Date());
  return (
    <>
      <View style={s.footerRule} fixed />
      <Text style={s.footerText} fixed>
        Draft prepared with {APP_NAME} on {stamp}. Not valid until verified and signed by the declarant (Part A) and the expert (Part B).
        {'\n'}Evidence {ctx.evidence.id.slice(0, 8)} · Certificate v{ctx.cert.version}
      </Text>
      <Text style={s.footerPage} fixed>
        {section}
      </Text>
    </>
  );
}

function browserLabel(): string {
  if (typeof navigator === 'undefined') return 'browser';
  const ua = navigator.userAgent;
  const pick = (re: RegExp, name: string) => {
    const m = re.exec(ua);
    return m ? `${name} ${m[1]}` : undefined;
  };
  return (
    pick(/Edg\/(\d+)/, 'Edge') ??
    pick(/OPR\/(\d+)/, 'Opera') ??
    pick(/Firefox\/(\d+)/, 'Firefox') ??
    pick(/Chrome\/(\d+)/, 'Chrome') ??
    pick(/Version\/(\d+).*Safari/, 'Safari') ??
    'browser'
  );
}

function KV({ k, v, mono }: { k: string; v?: string; mono?: boolean }) {
  return (
    <View style={s.kv} wrap={false}>
      <Text style={s.k}>{k}</Text>
      <Text style={[s.v, mono ? s.mono : {}]}>{v || '—'}</Text>
    </View>
  );
}

function trimName(n: string) {
  return n.length > 70 ? `${n.slice(0, 40)}…${n.slice(-25)}` : n;
}

function FileCard({ f, n, tool }: { f: EvidenceFile; n: number; tool: string }) {
  const acq =
    f.acquisitionHash != null
      ? `${f.acquisitionHash} (${(f.acquisitionHashAlgo ?? '').toUpperCase()}) — ${f.acquisitionHashMatch ? 'MATCHES' : 'DOES NOT MATCH'} the computed value`
      : undefined;
  return (
    <View style={s.fileCard} wrap={false}>
      <Text style={s.fileName}>
        {n}. {trimName(f.originalFilename)}
      </Text>
      <KV k="Size" v={`${f.sizeBytes.toLocaleString('en-IN')} bytes (${formatBytes(f.sizeBytes)})`} />
      <KV k="Detected type" v={`${KIND_LABEL[f.kind]}${f.detectedMime ? ` · ${f.detectedMime}` : ''}`} />
      {f.lastModified && <KV k="File last modified" v={formatIst(f.lastModified)} />}
      <KV k="SHA-256" v={f.sha256} mono />
      <KV k="SHA-1" v={f.sha1} mono />
      <KV k="MD5" v={f.md5} mono />
      {acq && <KV k="Hash at acquisition" v={acq} mono />}
      <KV k="Computed at" v={formatIstSeconds(f.hashedAt)} />
      <KV k="Tool" v={tool} />
      <KV k="File ID" v={f.id} mono />
      {f.members?.length ? (
        <View style={{ marginTop: 8 }}>
          <Text style={[s.small, { fontFamily: 'Helvetica-Bold', marginBottom: 3 }]}>
            Files inside this archive ({f.members.length}) — SHA-256 of each
          </Text>
          {f.members.map((m, i) => (
            <View key={i} style={s.memberRow} wrap={false}>
              <Text style={{ fontSize: 8 }}>
                {trimName(m.name)} <Text style={{ color: MUTED }}>· {formatBytes(m.sizeBytes)}</Text>
              </Text>
              <Text style={[s.mono, { fontSize: 7.8 }]}>{m.sha256}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function CertificateDocument({ ctx, draft }: { ctx: CertificateContext; draft: boolean }) {
  const a = buildPartValues('A', ctx);
  const b = buildPartValues('B', ctx);
  const tool = `hash-wasm ${HASH_WASM_VERSION} in ${browserLabel()}, on the user's device`;
  const ev = ctx.evidence;
  const watermark = draft ? <Text style={s.watermark} fixed>DRAFT</Text> : null;

  return (
    <Document
      title={`Section 63 BSA certificate — ${ev.title} (v${ctx.cert.version})`}
      author={APP_NAME}
      subject="Certificate under Section 63(4)(c), Bharatiya Sakshya Adhiniyam, 2023"
      creator={APP_NAME}
      producer={APP_NAME}
    >
      <Page size="A4" style={s.page}>
        {watermark}
        <Text style={s.heading1}>{SCHEDULE_HEADING[0]}</Text>
        <Text style={s.heading2}>{SCHEDULE_HEADING[1]}</Text>
        <Text style={s.heading3}>{SCHEDULE_HEADING[2]}</Text>
        <PartView part={PART_A} values={a} />
        <Footer ctx={ctx} section="Certificate · Part A" />
      </Page>

      <Page size="A4" style={s.page}>
        {watermark}
        <PartView part={PART_B} values={b} />
        <Footer ctx={ctx} section="Certificate · Part B" />
      </Page>

      <Page size="A4" style={s.page}>
        {watermark}
        <Text style={s.annexTitle}>ANNEXURE — HASH REPORT</Text>
        <Text style={s.annexSub}>
          Enclosed with the certificate under Section 63(4)(c) of the Bharatiya Sakshya Adhiniyam, 2023 · Certificate version{' '}
          {ctx.cert.version}
        </Text>

        <Text style={s.sectionTitle}>ELECTRONIC RECORD</Text>
        <KV k="Title" v={ev.title} />
        {ev.description ? <KV k="Description" v={ev.description} /> : null}
        <KV k="Manner of production (s.63(4)(a))" v={ev.mannerOfProduction} />
        {ev.courtName ? <KV k="Court / proceeding" v={ev.courtName} /> : null}
        {ev.caseNumber ? <KV k="Case number" v={ev.caseNumber} /> : null}
        <KV k="Algorithm stated in certificate" v={ctx.cert.hashAlgo.toUpperCase()} />
        <KV k="Number of files" v={String(ctx.files.length)} />
        <KV k="Evidence ID" v={ev.id} mono />

        <Text style={s.sectionTitle}>FILES</Text>
        {ctx.files.map((f, i) => (
          <FileCard key={f.id} f={f} n={i + 1} tool={tool} />
        ))}

        <Text style={s.sectionTitle}>METHOD</Text>
        <Text style={s.small}>
          Each file was read in 4 MB chunks and SHA-256 (FIPS 180-4), SHA-1 and MD5 were computed in a single pass, in the user&apos;s web
          browser. The files were not uploaded. Values are lowercase hexadecimal. To verify, recompute the hash of the same file with any
          standard tool, for example: sha256sum FILE (Linux), shasum -a 256 FILE (macOS) or certutil -hashfile FILE SHA256 (Windows).
          Identical output confirms the file is bit-for-bit the same as the one described in this report.
        </Text>
        <Footer ctx={ctx} section="Annexure · Hash Report" />
      </Page>
    </Document>
  );
}

export async function renderCertificatePdf(ctx: CertificateContext, opts: { draft: boolean }): Promise<Blob> {
  return pdf(<CertificateDocument ctx={ctx} draft={opts.draft} />).toBlob();
}
