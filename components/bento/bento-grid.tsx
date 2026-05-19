import type { Locale } from '@/i18n';
import { ProfileHubCard } from './profile-hub-card';
import { AiChatCard } from './ai-chat-card';
import { ProjectCard } from './project-card';
import { ExperienceCard } from './experience-card';
import { HonorsCard } from './honors-card';
import { TimelineCard } from './timeline-card';
import { EducationCard } from './education-card';
import { getHomeContent } from '@/lib/content';

export async function BentoGrid({ locale }: { locale: Locale }) {
  const { profile, projects, experiences, honors, education, timeline } = await getHomeContent();

  const projectCards = projects.slice(0, 3);
  const academicHero = projectCards.find((p) => p.kind === 'academic') ?? projectCards[0];
  const sideProjects = projectCards.filter((p) => p !== academicHero).slice(0, 2);
  const primaryExperience = experiences[0];
  const primaryEducation = education[0];

  return (
    <section
      id="home"
      className="grid grid-cols-1 gap-4 py-4 md:grid-cols-6 md:gap-5 md:py-8"
    >
<<<<<<< Updated upstream
      <ProfileHubCard profile={profile} locale={locale} className="md:col-span-4 md:row-span-2" />
      <AiChatCard className="md:col-span-2" />
=======
      {/* Row 1-2: Hero profile (8x2) + education card */}
      <ProfileHubCard
        profile={profile}
        locale={locale}
        className="md:col-span-8 md:row-span-2"
      />
      {primaryEducation && (
        <EducationCard
          education={primaryEducation}
          locale={locale}
          className="md:col-span-4 md:row-span-2"
        />
      )}
>>>>>>> Stashed changes

      <ResumeDownloadCard locale={locale} className="md:col-span-1" />
      {primaryEducation && (
        <EducationCard education={primaryEducation} locale={locale} className="md:col-span-1" />
      )}

      <div id="projects" className="md:col-span-6 mt-6 flex items-end justify-between">
        <h2 className="display-headline text-3xl sm:text-4xl text-gradient">
          {locale === 'zh' ? '硬核项目矩阵' : 'Project Matrix'}
        </h2>
        <p className="hidden text-sm text-muted-foreground sm:block">
          {locale === 'zh' ? '学术研究 · 工程落地' : 'Research · Engineering'}
        </p>
      </div>

      {academicHero && (
        <ProjectCard
          project={academicHero}
          locale={locale}
          className="md:col-span-4 md:row-span-2"
        />
      )}
      {sideProjects.map((p) => (
        <ProjectCard key={p.slug} project={p} locale={locale} className="md:col-span-2" />
      ))}

      <div id="experience" className="md:col-span-6 mt-6 flex items-end justify-between">
        <h2 className="display-headline text-3xl sm:text-4xl text-gradient">
          {locale === 'zh' ? '工作与实践' : 'Work & Practice'}
        </h2>
      </div>
      {primaryExperience && (
        <ExperienceCard
          experience={primaryExperience}
          locale={locale}
          className="md:col-span-3"
        />
      )}
      <HonorsCard honors={honors} locale={locale} className="md:col-span-3" />

      <div id="timeline" className="md:col-span-6 mt-6">
        <h2 className="display-headline text-3xl sm:text-4xl text-gradient">
          {locale === 'zh' ? '成长时间轴' : 'Growth Timeline'}
        </h2>
      </div>
      <TimelineCard events={timeline} locale={locale} className="md:col-span-6" />
    </section>
  );
}
