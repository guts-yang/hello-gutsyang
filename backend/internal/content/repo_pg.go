package content

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/guts-yang/hello-gutsyang/backend/internal/model"
)

type pgRepo struct {
	pool *pgxpool.Pool
}

func newPGRepo(pool *pgxpool.Pool) *pgRepo {
	return &pgRepo{pool: pool}
}

func (r *pgRepo) Home(ctx context.Context) (model.HomeContent, error) {
	profile, err := r.Profile(ctx)
	if err != nil {
		return model.HomeContent{}, err
	}
	projects, err := r.Projects(ctx, false)
	if err != nil {
		return model.HomeContent{}, err
	}
	experiences, err := r.Experiences(ctx, false)
	if err != nil {
		return model.HomeContent{}, err
	}
	honors, err := r.Honors(ctx, false)
	if err != nil {
		return model.HomeContent{}, err
	}
	education, err := r.Education(ctx)
	if err != nil {
		return model.HomeContent{}, err
	}
	timeline, err := r.Timeline(ctx)
	if err != nil {
		return model.HomeContent{}, err
	}
	return model.HomeContent{
		Profile:     profile,
		Projects:    projects,
		Experiences: experiences,
		Honors:      honors,
		Education:   education,
		Timeline:    timeline,
	}, nil
}

func (r *pgRepo) Snapshot(ctx context.Context) (model.ContentSnapshot, error) {
	home, err := r.Home(ctx)
	if err != nil {
		return model.ContentSnapshot{}, err
	}
	projects, err := r.Projects(ctx, true)
	if err != nil {
		return model.ContentSnapshot{}, err
	}
	experiences, err := r.Experiences(ctx, true)
	if err != nil {
		return model.ContentSnapshot{}, err
	}
	honors, err := r.Honors(ctx, true)
	if err != nil {
		return model.ContentSnapshot{}, err
	}
	return model.ContentSnapshot{
		Profile:     home.Profile,
		Projects:    projects,
		Experiences: experiences,
		Honors:      honors,
		Education:   home.Education,
		Timeline:    home.Timeline,
	}, nil
}

func (r *pgRepo) ImportSnapshot(ctx context.Context, snap model.ContentSnapshot) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `delete from timeline`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `delete from education`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `delete from honors`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `delete from experiences`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `delete from projects`); err != nil {
		return err
	}

	if err := r.upsertProfileTx(ctx, tx, snap.Profile); err != nil {
		return err
	}
	for _, p := range snap.Projects {
		if _, err := r.upsertProjectTx(ctx, tx, p); err != nil {
			return err
		}
	}
	for _, e := range snap.Experiences {
		if _, err := r.upsertExperienceTx(ctx, tx, e); err != nil {
			return err
		}
	}
	for _, h := range snap.Honors {
		if _, err := r.upsertHonorTx(ctx, tx, h); err != nil {
			return err
		}
	}
	for _, ed := range snap.Education {
		if err := r.upsertEducationTx(ctx, tx, ed); err != nil {
			return err
		}
	}
	for _, ev := range snap.Timeline {
		if err := r.upsertTimelineTx(ctx, tx, ev); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *pgRepo) Profile(ctx context.Context) (model.Profile, error) {
	row := r.pool.QueryRow(ctx, `
		select id, name_zh, name_en, handle, role_zh, role_en, slogan_zh, slogan_en,
		       bio_zh, bio_en, avatar_url, socials, updated_at
		from profile
		where id = 'main'
	`)
	var p model.Profile
	var socials []byte
	if err := row.Scan(
		&p.ID, &p.NameZH, &p.NameEN, &p.Handle,
		&p.Role.ZH, &p.Role.EN, &p.Slogan.ZH, &p.Slogan.EN,
		&p.Bio.ZH, &p.Bio.EN, &p.AvatarURL, &socials, &p.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.Profile{}, fmt.Errorf("profile not found")
		}
		return model.Profile{}, err
	}
	if len(socials) > 0 {
		_ = json.Unmarshal(socials, &p.Socials)
	}
	return p, nil
}

func (r *pgRepo) UpdateProfile(ctx context.Context, next model.Profile) (model.Profile, error) {
	next.ID = "main"
	next.UpdatedAt = time.Now().UTC()
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return model.Profile{}, err
	}
	defer tx.Rollback(ctx)
	if err := r.upsertProfileTx(ctx, tx, next); err != nil {
		return model.Profile{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return model.Profile{}, err
	}
	return next, nil
}

func (r *pgRepo) upsertProfileTx(ctx context.Context, tx pgx.Tx, p model.Profile) error {
	socials, err := json.Marshal(p.Socials)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		insert into profile (
			id, name_zh, name_en, handle, role_zh, role_en, slogan_zh, slogan_en,
			bio_zh, bio_en, avatar_url, socials, updated_at
		) values (
			'main', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
		)
		on conflict (id) do update set
			name_zh = excluded.name_zh,
			name_en = excluded.name_en,
			handle = excluded.handle,
			role_zh = excluded.role_zh,
			role_en = excluded.role_en,
			slogan_zh = excluded.slogan_zh,
			slogan_en = excluded.slogan_en,
			bio_zh = excluded.bio_zh,
			bio_en = excluded.bio_en,
			avatar_url = excluded.avatar_url,
			socials = excluded.socials,
			updated_at = excluded.updated_at
	`, p.NameZH, p.NameEN, p.Handle, p.Role.ZH, p.Role.EN, p.Slogan.ZH, p.Slogan.EN,
		p.Bio.ZH, p.Bio.EN, nullIfEmpty(p.AvatarURL), socials, p.UpdatedAt)
	return err
}

func (r *pgRepo) Projects(ctx context.Context, includeDrafts bool) ([]model.Project, error) {
	q := `
		select id, slug, kind, title_zh, title_en, tagline_zh, tagline_en,
		       summary_zh, summary_en, tags, highlights, link, repo, cover_url,
		       started_at, ended_at, display_order, is_published
		from projects
	`
	if !includeDrafts {
		q += ` where is_published = true`
	}
	q += ` order by display_order desc, started_at desc`

	rows, err := r.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.Project
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *pgRepo) ProjectBySlug(ctx context.Context, slug string) (*model.Project, error) {
	row := r.pool.QueryRow(ctx, `
		select id, slug, kind, title_zh, title_en, tagline_zh, tagline_en,
		       summary_zh, summary_en, tags, highlights, link, repo, cover_url,
		       started_at, ended_at, display_order, is_published
		from projects
		where slug = $1 and is_published = true
	`, slug)
	p, err := scanProjectRow(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *pgRepo) ProjectByID(ctx context.Context, id string) (*model.Project, error) {
	uid := stableEntityUUID("project", id)
	row := r.pool.QueryRow(ctx, `
		select id, slug, kind, title_zh, title_en, tagline_zh, tagline_en,
		       summary_zh, summary_en, tags, highlights, link, repo, cover_url,
		       started_at, ended_at, display_order, is_published
		from projects where id = $1
	`, uid)
	p, err := scanProjectRow(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *pgRepo) UpsertProject(ctx context.Context, next model.Project) (model.Project, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return model.Project{}, err
	}
	defer tx.Rollback(ctx)
	out, err := r.upsertProjectTx(ctx, tx, next)
	if err != nil {
		return model.Project{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return model.Project{}, err
	}
	return out, nil
}

func (r *pgRepo) upsertProjectTx(ctx context.Context, tx pgx.Tx, next model.Project) (model.Project, error) {
	uid := stableEntityUUID("project", next.ID)
	if next.ID == "" {
		uid = uuid.New()
	}
	next.ID = uid.String()
	next.Slug = strings.TrimSpace(next.Slug)

	started, err := parseContentDate(next.StartedAt)
	if err != nil {
		return model.Project{}, fmt.Errorf("project startedAt: %w", err)
	}
	ended, err := optionalDatePtr(next.EndedAt)
	if err != nil {
		return model.Project{}, fmt.Errorf("project endedAt: %w", err)
	}
	highlights, err := json.Marshal(next.Highlights)
	if err != nil {
		return model.Project{}, err
	}

	_, err = tx.Exec(ctx, `
		insert into projects (
			id, slug, kind, title_zh, title_en, tagline_zh, tagline_en,
			summary_zh, summary_en, tags, highlights, link, repo, cover_url,
			started_at, ended_at, display_order, is_published, updated_at
		) values (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, now()
		)
		on conflict (id) do update set
			slug = excluded.slug,
			kind = excluded.kind,
			title_zh = excluded.title_zh,
			title_en = excluded.title_en,
			tagline_zh = excluded.tagline_zh,
			tagline_en = excluded.tagline_en,
			summary_zh = excluded.summary_zh,
			summary_en = excluded.summary_en,
			tags = excluded.tags,
			highlights = excluded.highlights,
			link = excluded.link,
			repo = excluded.repo,
			cover_url = excluded.cover_url,
			started_at = excluded.started_at,
			ended_at = excluded.ended_at,
			display_order = excluded.display_order,
			is_published = excluded.is_published,
			updated_at = now()
	`, uid, next.Slug, next.Kind, next.Title.ZH, next.Title.EN, next.Tagline.ZH, next.Tagline.EN,
		next.Summary.ZH, next.Summary.EN, next.Tags, highlights,
		nullIfEmpty(next.Link), nullIfEmpty(next.Repo), nullIfEmpty(next.CoverURL),
		started, ended, next.DisplayOrder, next.IsPublished)
	if err != nil {
		return model.Project{}, err
	}
	return next, nil
}

func (r *pgRepo) DeleteProject(ctx context.Context, id string) error {
	uid := stableEntityUUID("project", id)
	_, err := r.pool.Exec(ctx, `delete from projects where id = $1`, uid)
	return err
}

func (r *pgRepo) Experiences(ctx context.Context, includeDrafts bool) ([]model.Experience, error) {
	q := `
		select id, slug, org_zh, org_en, role_zh, role_en, summary_zh, summary_en,
		       metrics, link, started_at, ended_at, display_order, is_published
		from experiences
	`
	if !includeDrafts {
		q += ` where is_published = true`
	}
	q += ` order by display_order desc, started_at desc`

	rows, err := r.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.Experience
	for rows.Next() {
		e, err := scanExperience(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *pgRepo) ExperienceBySlug(ctx context.Context, slug string) (*model.Experience, error) {
	row := r.pool.QueryRow(ctx, `
		select id, slug, org_zh, org_en, role_zh, role_en, summary_zh, summary_en,
		       metrics, link, started_at, ended_at, display_order, is_published
		from experiences where slug = $1 and is_published = true
	`, slug)
	e, err := scanExperienceRow(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *pgRepo) ExperienceByID(ctx context.Context, id string) (*model.Experience, error) {
	uid := stableEntityUUID("experience", id)
	row := r.pool.QueryRow(ctx, `
		select id, slug, org_zh, org_en, role_zh, role_en, summary_zh, summary_en,
		       metrics, link, started_at, ended_at, display_order, is_published
		from experiences where id = $1
	`, uid)
	e, err := scanExperienceRow(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *pgRepo) UpsertExperience(ctx context.Context, next model.Experience) (model.Experience, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return model.Experience{}, err
	}
	defer tx.Rollback(ctx)
	out, err := r.upsertExperienceTx(ctx, tx, next)
	if err != nil {
		return model.Experience{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return model.Experience{}, err
	}
	return out, nil
}

func (r *pgRepo) upsertExperienceTx(ctx context.Context, tx pgx.Tx, next model.Experience) (model.Experience, error) {
	uid := stableEntityUUID("experience", next.ID)
	if next.ID == "" {
		uid = uuid.New()
	}
	next.ID = uid.String()
	started, err := parseContentDate(next.StartedAt)
	if err != nil {
		return model.Experience{}, err
	}
	ended, err := optionalDatePtr(next.EndedAt)
	if err != nil {
		return model.Experience{}, err
	}
	metrics, err := json.Marshal(next.Metrics)
	if err != nil {
		return model.Experience{}, err
	}
	_, err = tx.Exec(ctx, `
		insert into experiences (
			id, slug, org_zh, org_en, role_zh, role_en, summary_zh, summary_en,
			metrics, link, started_at, ended_at, display_order, is_published, updated_at
		) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())
		on conflict (id) do update set
			slug = excluded.slug,
			org_zh = excluded.org_zh, org_en = excluded.org_en,
			role_zh = excluded.role_zh, role_en = excluded.role_en,
			summary_zh = excluded.summary_zh, summary_en = excluded.summary_en,
			metrics = excluded.metrics, link = excluded.link,
			started_at = excluded.started_at, ended_at = excluded.ended_at,
			display_order = excluded.display_order, is_published = excluded.is_published,
			updated_at = now()
	`, uid, next.Slug, next.Org.ZH, next.Org.EN, next.Role.ZH, next.Role.EN,
		next.Summary.ZH, next.Summary.EN, metrics, nullIfEmpty(next.Link),
		started, ended, next.DisplayOrder, next.IsPublished)
	if err != nil {
		return model.Experience{}, err
	}
	return next, nil
}

func (r *pgRepo) DeleteExperience(ctx context.Context, id string) error {
	uid := stableEntityUUID("experience", id)
	_, err := r.pool.Exec(ctx, `delete from experiences where id = $1`, uid)
	return err
}

func (r *pgRepo) Honors(ctx context.Context, includeDrafts bool) ([]model.Honor, error) {
	q := `
		select id, pillar, title_zh, title_en, story_zh, story_en, display_order, is_published
		from honors
	`
	if !includeDrafts {
		q += ` where is_published = true`
	}
	q += ` order by display_order desc`

	rows, err := r.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.Honor
	for rows.Next() {
		h, err := scanHonor(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

func (r *pgRepo) HonorByID(ctx context.Context, id string) (*model.Honor, error) {
	uid := stableEntityUUID("honor", id)
	row := r.pool.QueryRow(ctx, `
		select id, pillar, title_zh, title_en, story_zh, story_en, display_order, is_published
		from honors where id = $1
	`, uid)
	h, err := scanHonorRow(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &h, nil
}

func (r *pgRepo) UpsertHonor(ctx context.Context, next model.Honor) (model.Honor, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return model.Honor{}, err
	}
	defer tx.Rollback(ctx)
	out, err := r.upsertHonorTx(ctx, tx, next)
	if err != nil {
		return model.Honor{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return model.Honor{}, err
	}
	return out, nil
}

func (r *pgRepo) upsertHonorTx(ctx context.Context, tx pgx.Tx, next model.Honor) (model.Honor, error) {
	uid := stableEntityUUID("honor", next.ID)
	if next.ID == "" {
		uid = uuid.New()
	}
	next.ID = uid.String()
	_, err := tx.Exec(ctx, `
		insert into honors (id, pillar, title_zh, title_en, story_zh, story_en, display_order, is_published, updated_at)
		values ($1,$2,$3,$4,$5,$6,$7,$8,now())
		on conflict (id) do update set
			pillar = excluded.pillar,
			title_zh = excluded.title_zh, title_en = excluded.title_en,
			story_zh = excluded.story_zh, story_en = excluded.story_en,
			display_order = excluded.display_order, is_published = excluded.is_published,
			updated_at = now()
	`, uid, next.Pillar, next.Title.ZH, next.Title.EN, next.Story.ZH, next.Story.EN,
		next.DisplayOrder, next.IsPublished)
	if err != nil {
		return model.Honor{}, err
	}
	return next, nil
}

func (r *pgRepo) DeleteHonor(ctx context.Context, id string) error {
	uid := stableEntityUUID("honor", id)
	_, err := r.pool.Exec(ctx, `delete from honors where id = $1`, uid)
	return err
}

func (r *pgRepo) Education(ctx context.Context) ([]model.Education, error) {
	rows, err := r.pool.Query(ctx, `
		select id, school_zh, school_en, degree_zh, degree_en, notes_zh, notes_en,
		       started_at, ended_at, display_order
		from education
		order by display_order desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.Education
	for rows.Next() {
		var id uuid.UUID
		var e model.Education
		var started time.Time
		var ended *time.Time
		var notesZH, notesEN *string
		if err := rows.Scan(
			&id, &e.School.ZH, &e.School.EN, &e.Degree.ZH, &e.Degree.EN,
			&notesZH, &notesEN, &started, &ended, &e.DisplayOrder,
		); err != nil {
			return nil, err
		}
		e.ID = id.String()
		if notesZH != nil {
			e.Notes.ZH = *notesZH
		}
		if notesEN != nil {
			e.Notes.EN = *notesEN
		}
		e.StartedAt = formatContentDate(started)
		e.EndedAt = derefDate(ended)
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *pgRepo) upsertEducationTx(ctx context.Context, tx pgx.Tx, ed model.Education) error {
	uid := stableEntityUUID("education", ed.ID)
	if ed.ID == "" {
		uid = uuid.New()
	}
	started, err := parseContentDate(ed.StartedAt)
	if err != nil {
		return err
	}
	ended, err := optionalDatePtr(ed.EndedAt)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		insert into education (
			id, school_zh, school_en, degree_zh, degree_en, notes_zh, notes_en,
			started_at, ended_at, display_order, updated_at
		) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
		on conflict (id) do update set
			school_zh = excluded.school_zh, school_en = excluded.school_en,
			degree_zh = excluded.degree_zh, degree_en = excluded.degree_en,
			notes_zh = excluded.notes_zh, notes_en = excluded.notes_en,
			started_at = excluded.started_at, ended_at = excluded.ended_at,
			display_order = excluded.display_order, updated_at = now()
	`, uid, ed.School.ZH, ed.School.EN, ed.Degree.ZH, ed.Degree.EN,
		nullIfEmpty(ed.Notes.ZH), nullIfEmpty(ed.Notes.EN), started, ended, ed.DisplayOrder)
	return err
}

func (r *pgRepo) Timeline(ctx context.Context) ([]model.TimelineEvent, error) {
	rows, err := r.pool.Query(ctx, `
		select id, date, kind, title_zh, title_en, body_zh, body_en
		from timeline
		order by date asc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.TimelineEvent
	for rows.Next() {
		var id uuid.UUID
		var ev model.TimelineEvent
		var date time.Time
		if err := rows.Scan(&id, &date, &ev.Kind, &ev.Title.ZH, &ev.Title.EN, &ev.Body.ZH, &ev.Body.EN); err != nil {
			return nil, err
		}
		ev.ID = id.String()
		ev.Date = formatContentDate(date)
		out = append(out, ev)
	}
	return out, rows.Err()
}

func (r *pgRepo) upsertTimelineTx(ctx context.Context, tx pgx.Tx, ev model.TimelineEvent) error {
	uid := stableEntityUUID("timeline", ev.ID)
	if ev.ID == "" {
		uid = uuid.New()
	}
	date, err := parseContentDate(ev.Date)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		insert into timeline (id, date, kind, title_zh, title_en, body_zh, body_en, updated_at)
		values ($1,$2,$3,$4,$5,$6,$7,now())
		on conflict (id) do update set
			date = excluded.date, kind = excluded.kind,
			title_zh = excluded.title_zh, title_en = excluded.title_en,
			body_zh = excluded.body_zh, body_en = excluded.body_en,
			updated_at = now()
	`, uid, date, ev.Kind, ev.Title.ZH, ev.Title.EN, ev.Body.ZH, ev.Body.EN)
	return err
}

func (r *pgRepo) Stats(ctx context.Context) (ContentStats, error) {
	row := r.pool.QueryRow(ctx, `
		select
			(select count(*)::int from projects),
			(select count(*)::int from experiences),
			(select count(*)::int from honors)
	`)
	var s ContentStats
	if err := row.Scan(&s.Projects, &s.Experiences, &s.Honors); err != nil {
		return ContentStats{}, err
	}
	return s, nil
}

func nullIfEmpty(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

type scannable interface {
	Scan(dest ...any) error
}

func scanProject(rows scannable) (model.Project, error) {
	return scanProjectRow(rows)
}

func scanProjectRow(row scannable) (model.Project, error) {
	var id uuid.UUID
	var p model.Project
	var highlights []byte
	var started time.Time
	var ended *time.Time
	var link, repo, cover *string
	if err := row.Scan(
		&id, &p.Slug, &p.Kind, &p.Title.ZH, &p.Title.EN, &p.Tagline.ZH, &p.Tagline.EN,
		&p.Summary.ZH, &p.Summary.EN, &p.Tags, &highlights, &link, &repo, &cover,
		&started, &ended, &p.DisplayOrder, &p.IsPublished,
	); err != nil {
		return model.Project{}, err
	}
	p.ID = id.String()
	if len(highlights) > 0 {
		_ = json.Unmarshal(highlights, &p.Highlights)
	}
	if link != nil {
		p.Link = *link
	}
	if repo != nil {
		p.Repo = *repo
	}
	if cover != nil {
		p.CoverURL = *cover
	}
	p.StartedAt = formatContentDate(started)
	p.EndedAt = derefDate(ended)
	return p, nil
}

func scanExperience(rows scannable) (model.Experience, error) {
	return scanExperienceRow(rows)
}

func scanExperienceRow(row scannable) (model.Experience, error) {
	var id uuid.UUID
	var e model.Experience
	var metrics []byte
	var started time.Time
	var ended *time.Time
	var link *string
	if err := row.Scan(
		&id, &e.Slug, &e.Org.ZH, &e.Org.EN, &e.Role.ZH, &e.Role.EN,
		&e.Summary.ZH, &e.Summary.EN, &metrics, &link, &started, &ended,
		&e.DisplayOrder, &e.IsPublished,
	); err != nil {
		return model.Experience{}, err
	}
	e.ID = id.String()
	if len(metrics) > 0 {
		_ = json.Unmarshal(metrics, &e.Metrics)
	}
	if link != nil {
		e.Link = *link
	}
	e.StartedAt = formatContentDate(started)
	e.EndedAt = derefDate(ended)
	return e, nil
}

func scanHonor(rows scannable) (model.Honor, error) {
	return scanHonorRow(rows)
}

func scanHonorRow(row scannable) (model.Honor, error) {
	var id uuid.UUID
	var h model.Honor
	if err := row.Scan(&id, &h.Pillar, &h.Title.ZH, &h.Title.EN, &h.Story.ZH, &h.Story.EN, &h.DisplayOrder, &h.IsPublished); err != nil {
		return model.Honor{}, err
	}
	h.ID = id.String()
	return h, nil
}
