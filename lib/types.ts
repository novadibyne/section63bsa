// Field names match the Phase 2 SQL schema (docs/SPECIFICATION.md, Appendix A).

export type EvidenceType = 'image' | 'audio' | 'video' | 'document' | 'whatsapp_export' | 'email' | 'other';
export type EvidenceStatus = 'draft' | 'hashed' | 'certificate_drafted' | 'finalised' | 'archived';
export type DeviceCategory =
  | 'computer_storage_media'
  | 'dvr'
  | 'mobile'
  | 'flash_drive'
  | 'cd_dvd'
  | 'server'
  | 'cloud'
  | 'other';
export type ControlType = 'owned' | 'maintained' | 'managed' | 'operated';
export type IdentifierType = 'imei' | 'uin' | 'uid' | 'mac' | 'cloud_id' | 'other';
export type HashAlgo = 'sha256' | 'sha1' | 'md5' | 'other';

export interface Evidence {
  id: string;
  title: string;
  description?: string;
  evidenceType: EvidenceType;
  /** s.63(4)(a): the manner in which the electronic record was produced. */
  mannerOfProduction?: string;
  acquiredAt?: string;
  courtName?: string;
  caseNumber?: string;
  status: EvidenceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FileMember {
  name: string;
  sizeBytes: number;
  sha256: string;
}

export interface EvidenceFile {
  id: string;
  evidenceId: string;
  originalFilename: string;
  declaredMime?: string;
  detectedMime?: string;
  detectedExt?: string;
  kind: EvidenceType;
  sizeBytes: number;
  lastModified?: string;
  sha256: string;
  sha1: string;
  md5: string;
  hashedAt: string;
  acquisitionHash?: string;
  acquisitionHashAlgo?: HashAlgo;
  acquisitionHashMatch?: boolean;
  lastVerifiedAt?: string;
  lastVerifiedMatch?: boolean;
  metadata: Record<string, unknown>;
  /** Files inside an archive (e.g. a WhatsApp .zip export), each hashed separately. */
  members?: FileMember[];
  blobStored: boolean;
  addedAt: string;
}

export interface DeviceIdentifier {
  idType: IdentifierType;
  value: string;
}

export interface Device {
  id: string;
  evidenceId: string;
  categories: DeviceCategory[];
  categoryOther?: string;
  makeModel?: string;
  color?: string;
  serialNumber?: string;
  otherInfo?: string;
  identifiers: DeviceIdentifier[];
  createdAt: string;
}

export interface Declarant {
  fullName: string;
  relationName: string;
  addressOrEmployer: string;
  /** yyyy-MM-dd, printed as DD/MM/YYYY */
  date: string;
  /** HH:mm, 24-hour IST */
  time: string;
  place: string;
}

export interface PartA extends Declarant {
  control: ControlType[];
}

export interface PartB extends Declarant {
  designation: string;
  qualification: string;
}

export interface Certificate {
  id: string;
  evidenceId: string;
  version: number;
  scheduleVersion: 'BSA-2023-original';
  partA: PartA;
  partB: PartB;
  hashAlgo: HashAlgo;
  hashAlgoOther?: string;
  declarationAcknowledgedAt?: string;
  status: 'draft' | 'finalised';
  pdfSha256?: string;
  generatedAt?: string;
  finalisedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredPdf {
  certificateId: string;
  blob: Blob;
  sha256: string;
  final: boolean;
  createdAt: string;
}

export type AuditAction =
  | 'evidence.create'
  | 'evidence.update'
  | 'evidence.delete'
  | 'file.add'
  | 'file.hash'
  | 'file.remove'
  | 'file.reverify'
  | 'file.acquisition_hash'
  | 'device.save'
  | 'device.remove'
  | 'certificate.create'
  | 'certificate.generate'
  | 'certificate.finalise'
  | 'certificate.download'
  | 'bundle.export'
  | 'bundle.import'
  | 'data.clear';

export interface AuditEvent {
  seq?: number;
  action: AuditAction;
  evidenceId?: string;
  certificateId?: string;
  details: Record<string, unknown>;
  userAgent: string;
  createdAt: string;
  prevHash: string;
  rowHash: string;
}

export interface ProfileDefaults {
  party: Partial<Declarant>;
  expert: Partial<PartB>;
}
