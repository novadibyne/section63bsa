import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type SavedObject = { type: string; id: string; attributes: Record<string, any>; references: { name: string; type: string; id: string }[]; typeMigrationVersion?: string };

const built = execFileSync(process.execPath, ['telemetry/kibana/build-dashboard.mjs'], { encoding: 'utf8' });
const objects: SavedObject[] = built.trim().split('\n').map((line) => JSON.parse(line));

describe('Kibana dashboard', () => {
  it('is the file in the repository (rebuild it after changing build-dashboard.mjs)', () => {
    expect(readFileSync('telemetry/kibana/legal-hashed-dashboard.ndjson', 'utf8')).toBe(built);
  });

  it('has every object it refers to, each with a Kibana version', () => {
    const ids = new Set(objects.map((o) => `${o.type}:${o.id}`));
    for (const o of objects) {
      expect(o.typeMigrationVersion, o.id).toBeTruthy();
      for (const ref of o.references) expect(ids.has(`${ref.type}:${ref.id}`), `${o.id} → ${ref.id}`).toBe(true);
    }
    const dashboard = objects.find((o) => o.type === 'dashboard')!;
    const panels = JSON.parse(dashboard.attributes.panelsJSON);
    expect(panels).toHaveLength(dashboard.references.length);
    for (const p of panels) expect(dashboard.references.some((r) => r.name === `${p.panelIndex}:${p.panelRefName}`)).toBe(true);
  });

  it('shows unique IPs with counts at the side, the map and the heatmap', () => {
    const byId = (id: string) => objects.find((o) => o.id === id)!;
    const table = byId('legal-hashed-ip-table').attributes.state.datasourceStates.formBased.layers.layer1.columns;
    expect(table.ip).toMatchObject({ operationType: 'terms', sourceField: 'resource.attributes.client.address' });
    expect(table.visits).toMatchObject({ operationType: 'count' });

    const layers = JSON.parse(byId('legal-hashed-map').attributes.layerListJSON);
    const geo = layers.filter((l: any) => l.sourceDescriptor.type === 'ES_GEO_GRID');
    expect(geo.map((l: any) => l.sourceDescriptor.requestType)).toEqual(['heatmap', 'point']);
    for (const l of geo) expect(l.sourceDescriptor.geoField).toBe('resource.attributes.client.geo.location');
    // Kibana Maps calls a unique count "cardinality".
    expect(geo[1].sourceDescriptor.metrics[0]).toMatchObject({ type: 'cardinality', field: 'resource.attributes.client.address' });

    expect(byId('legal-hashed-heatmap').attributes.visualizationType).toBe('lnsHeatmap');
  });

  it('lists the certificates made, drafts included, and counts each certificate once', () => {
    const byId = (id: string) => objects.find((o) => o.id === id)!;
    const list = byId('legal-hashed-certificates');
    expect(list.type).toBe('search');
    expect(JSON.parse(list.attributes.kibanaSavedObjectMeta.searchSourceJSON).query.query).toBe('attributes.event.name : "pdf_generated"');
    expect(list.attributes.columns).toEqual(
      expect.arrayContaining(['attributes.legal_hashed.kind', 'attributes.legal_hashed.parts', 'attributes.legal_hashed.evidence_type', 'attributes.legal_hashed.device_types']),
    );
    const parts = byId('legal-hashed-cert-parts').attributes.state;
    expect(parts.query.query).toBe('attributes.event.name : "pdf_generated"');
    const columns = parts.datasourceStates.formBased.layers.layer1.columns;
    expect(columns.group).toMatchObject({ operationType: 'terms', sourceField: 'attributes.legal_hashed.parts' });
    expect(columns.certificates).toMatchObject({ operationType: 'unique_count', sourceField: 'attributes.legal_hashed.certificate_id' });
  });
});
