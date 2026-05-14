import 'server-only';
import {
  getProfile,
  getProjects,
  getExperiences,
  getHonors,
  getEducation,
} from '@/lib/content';

/**
 * Builds a system prompt that grounds the AI assistant in the latest profile
 * data so it can answer "About me" questions accurately. Refreshed on every
 * request so DB edits flow through without redeploys.
 */
export async function buildSystemPrompt(locale: 'zh' | 'en'): Promise<string> {
  const [profile, projects, experiences, honors, education] = await Promise.all([
    getProfile(),
    getProjects(),
    getExperiences(),
    getHonors(),
    getEducation(),
  ]);

  const lang = locale === 'zh' ? 'zh' : 'en';
  const ownerName = lang === 'zh' ? profile.nameZh : profile.nameEn;

  const sections = [
    `[BASIC]\n` +
      `name: ${ownerName} (handle: ${profile.handle})\n` +
      `role: ${profile.role[lang]}\n` +
      `slogan: ${profile.slogan[lang]}\n` +
      `bio: ${profile.bio[lang]}`,
    `[PROJECTS]\n` +
      projects
        .map(
          (p, i) =>
            `${i + 1}. (${p.kind}) ${p.title[lang]}\n   tagline: ${p.tagline[lang]}\n   summary: ${p.summary[lang]}\n   tags: ${p.tags.join(', ')}\n   highlights: ${p.highlights.map((h) => h[lang]).join(' | ')}`,
        )
        .join('\n\n'),
    `[EXPERIENCES]\n` +
      experiences
        .map(
          (e, i) =>
            `${i + 1}. ${e.org[lang]} — ${e.role[lang]} (${e.startedAt}${e.endedAt ? ' to ' + e.endedAt : ' to present'})\n   ${e.summary[lang]}\n   metrics: ${e.metrics.map((m) => m[lang]).join(' | ')}`,
        )
        .join('\n\n'),
    `[HONORS]\n` +
      honors.map((h) => `- (${h.pillar}) ${h.title[lang]}: ${h.story[lang]}`).join('\n'),
    `[EDUCATION]\n` +
      education
        .map(
          (e) =>
            `- ${e.school[lang]}, ${e.degree[lang]} (${e.startedAt}${e.endedAt ? ' to ' + e.endedAt : ' to present'})${e.notes ? ' — ' + e.notes[lang] : ''}`,
        )
        .join('\n'),
  ];

  const persona =
    lang === 'zh'
      ? `你是 ${ownerName} 个人网站的 AI 助手。你的职责是用第一人称之外的视角（用"他/${ownerName}"），简洁、自然、客观地介绍这个网站主人。`
      : `You are the AI concierge of ${ownerName}'s personal website. Talk about him in third person, concise, friendly, and grounded in the data below.`;

  const rules =
    lang === 'zh'
      ? [
          '只回答与网站主人本人相关的问题；无关请礼貌引导回主题。',
          '回答简短（≤120 字），重点突出，可以分点。',
          '没把握就说"目前公开资料里没有提到，建议直接联系他的 GitHub / Email"。',
          '禁止编造未在以下数据中出现的项目、经历、奖项或数字。',
          '回答始终使用与提问者相同的语言（中文或英文）。',
        ]
      : [
          'Only answer questions about the site owner; gently redirect off-topic asks.',
          'Keep replies short (<= 80 words), high-signal, bullet points OK.',
          'If unsure, say "the public materials don\'t cover that—reach out via GitHub / Email."',
          'Never invent projects, experiences, awards, or numbers beyond the data below.',
          'Always reply in the language the user wrote in.',
        ];

  return [
    persona,
    'Rules:',
    ...rules.map((r, i) => `${i + 1}. ${r}`),
    '',
    'Profile data (source of truth, refreshed each request):',
    ...sections,
  ].join('\n');
}
