import { NextRequest } from 'next/server';
import { renderToStream, Document, Page, Text, View, StyleSheet, Link } from '@react-pdf/renderer';
import {
  getProfile,
  getProjects,
  getExperiences,
  getHonors,
  getEducation,
} from '@/lib/content';
import type { Locale } from '@/i18n';
import type { ReactElement } from 'react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: '#1f2937' },
  hero: { marginBottom: 16 },
  name: { fontSize: 24, fontWeight: 700, color: '#0f172a' },
  role: { fontSize: 11, color: '#0f62fe', marginTop: 2 },
  bio: { fontSize: 9.5, color: '#374151', marginTop: 6, lineHeight: 1.4 },
  contactRow: { flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  contact: { fontSize: 9, color: '#374151' },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#0f172a',
    marginTop: 16,
    paddingBottom: 4,
    borderBottom: '1pt solid #d1d5db',
  },
  item: { marginTop: 8 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  itemTitle: { fontSize: 10.5, fontWeight: 700, color: '#0f172a' },
  itemMeta: { fontSize: 9, color: '#6b7280' },
  itemSub: { fontSize: 9.5, color: '#374151', marginTop: 1 },
  bullet: { flexDirection: 'row', marginTop: 2 },
  bulletDot: { width: 10, fontSize: 9 },
  bulletText: { flex: 1, fontSize: 9.5, color: '#1f2937', lineHeight: 1.35 },
  tags: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: {
    fontSize: 8,
    color: '#0f62fe',
    backgroundColor: '#e8f3ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  footer: {
    position: 'absolute',
    fontSize: 8,
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#9ca3af',
  },
});

function fmtDate(s: string | undefined | null) {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  const lang = (req.nextUrl.searchParams.get('lang') || 'zh') as Locale;
  const [profile, projects, experiences, honors, education] = await Promise.all([
    getProfile(),
    getProjects(),
    getExperiences(),
    getHonors(),
    getEducation(),
  ]);

  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const name = lang === 'zh' ? profile.nameZh : profile.nameEn;

  const doc: ReactElement = (
    <Document
      author={name}
      title={`${name} · ${t('简历', 'Resume')}`}
      subject={profile.role[lang]}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.hero}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.role}>{profile.role[lang]}</Text>
          <Text style={styles.bio}>{profile.bio[lang]}</Text>
          <View style={styles.contactRow}>
            {profile.socials.map((s) => (
              <Link key={s.type} src={s.href} style={styles.contact}>
                {s.type}: {s.label || s.href}
              </Link>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('教育背景', 'Education')}</Text>
        {education.map((e, i) => (
          <View key={i} style={styles.item}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemTitle}>{e.school[lang]}</Text>
              <Text style={styles.itemMeta}>
                {fmtDate(e.startedAt)} — {fmtDate(e.endedAt) || t('至今', 'Present')}
              </Text>
            </View>
            <Text style={styles.itemSub}>{e.degree[lang]}</Text>
            {e.notes && <Text style={styles.itemSub}>{e.notes[lang]}</Text>}
          </View>
        ))}

        <Text style={styles.sectionTitle}>{t('项目', 'Projects')}</Text>
        {projects.map((p, i) => (
          <View key={i} style={styles.item} wrap={false}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemTitle}>{p.title[lang]}</Text>
              <Text style={styles.itemMeta}>
                {fmtDate(p.startedAt)}
                {p.endedAt ? ` — ${fmtDate(p.endedAt)}` : ''}
                {' · '}
                {p.kind}
              </Text>
            </View>
            <Text style={styles.itemSub}>{p.tagline[lang]}</Text>
            <Text style={[styles.itemSub, { marginTop: 2 }]}>{p.summary[lang]}</Text>
            {p.highlights.map((h, j) => (
              <View key={j} style={styles.bullet}>
                <Text style={styles.bulletDot}>·</Text>
                <Text style={styles.bulletText}>{h[lang]}</Text>
              </View>
            ))}
            <View style={styles.tags}>
              {p.tags.map((tag) => (
                <Text key={tag} style={styles.tag}>
                  {tag}
                </Text>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>{t('实践经历', 'Experience')}</Text>
        {experiences.map((e, i) => (
          <View key={i} style={styles.item} wrap={false}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemTitle}>
                {e.org[lang]} <Text style={styles.itemMeta}>· {e.role[lang]}</Text>
              </Text>
              <Text style={styles.itemMeta}>
                {fmtDate(e.startedAt)} — {fmtDate(e.endedAt) || t('至今', 'Present')}
              </Text>
            </View>
            <Text style={styles.itemSub}>{e.summary[lang]}</Text>
            {e.metrics.map((m, j) => (
              <View key={j} style={styles.bullet}>
                <Text style={styles.bulletDot}>·</Text>
                <Text style={styles.bulletText}>{m[lang]}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.sectionTitle}>{t('综合素养', 'Strengths')}</Text>
        {honors.map((h, i) => (
          <View key={i} style={styles.item} wrap={false}>
            <Text style={styles.itemTitle}>{h.title[lang]}</Text>
            <Text style={styles.itemSub}>{h.story[lang]}</Text>
          </View>
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `${name} · ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );

  const stream = await renderToStream(doc);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);

  const filename = `${name}-Resume-${lang}.pdf`;
  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  });
}
