package content

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/guts-yang/hello-gutsyang/backend/internal/model"
)

// Service is the CMS facade used by HTTP handlers and AI context.
type Service struct {
	repo Repo
}

// NewService wires Postgres when pool is non-nil, otherwise the file snapshot.
func NewService(dataDir string, pool *pgxpool.Pool) (*Service, error) {
	if pool != nil {
		pg := newPGRepo(pool)
		if err := ensurePGSeeded(context.Background(), pg, dataDir); err != nil {
			return nil, err
		}
		return &Service{repo: pg}, nil
	}
	file, err := newFileRepo(dataDir)
	if err != nil {
		return nil, err
	}
	return &Service{repo: file}, nil
}

func ensurePGSeeded(ctx context.Context, pg *pgRepo, dataDir string) error {
	if _, err := pg.Profile(ctx); err == nil {
		return nil
	}
	if err := importFromFileIfPresent(ctx, pg, dataDir); err == nil {
		return nil
	}
	return pg.ImportSnapshot(ctx, seedSnapshot())
}

func importFromFileIfPresent(ctx context.Context, repo Repo, dataDir string) error {
	file, err := newFileRepo(dataDir)
	if err != nil {
		return err
	}
	snap, err := file.Snapshot(ctx)
	if err != nil || strings.TrimSpace(snap.Profile.NameZH) == "" {
		return err
	}
	return repo.ImportSnapshot(ctx, snap)
}

func (s *Service) Home(ctx context.Context) (model.HomeContent, error) {
	return s.repo.Home(ctx)
}

func (s *Service) Snapshot(ctx context.Context) (model.ContentSnapshot, error) {
	return s.repo.Snapshot(ctx)
}

func (s *Service) ImportSnapshot(ctx context.Context, snap model.ContentSnapshot) error {
	return s.repo.ImportSnapshot(ctx, snap)
}

func (s *Service) Profile(ctx context.Context) (model.Profile, error) {
	return s.repo.Profile(ctx)
}

func (s *Service) UpdateProfile(ctx context.Context, next model.Profile) (model.Profile, error) {
	return s.repo.UpdateProfile(ctx, next)
}

func (s *Service) Projects(ctx context.Context, includeDrafts bool) ([]model.Project, error) {
	return s.repo.Projects(ctx, includeDrafts)
}

func (s *Service) ProjectBySlug(ctx context.Context, slug string) (*model.Project, error) {
	return s.repo.ProjectBySlug(ctx, slug)
}

func (s *Service) ProjectByID(ctx context.Context, id string) (*model.Project, error) {
	return s.repo.ProjectByID(ctx, id)
}

func (s *Service) UpsertProject(ctx context.Context, next model.Project) (model.Project, error) {
	return s.repo.UpsertProject(ctx, next)
}

func (s *Service) DeleteProject(ctx context.Context, id string) error {
	return s.repo.DeleteProject(ctx, id)
}

func (s *Service) Experiences(ctx context.Context, includeDrafts bool) ([]model.Experience, error) {
	return s.repo.Experiences(ctx, includeDrafts)
}

func (s *Service) ExperienceBySlug(ctx context.Context, slug string) (*model.Experience, error) {
	return s.repo.ExperienceBySlug(ctx, slug)
}

func (s *Service) ExperienceByID(ctx context.Context, id string) (*model.Experience, error) {
	return s.repo.ExperienceByID(ctx, id)
}

func (s *Service) UpsertExperience(ctx context.Context, next model.Experience) (model.Experience, error) {
	return s.repo.UpsertExperience(ctx, next)
}

func (s *Service) DeleteExperience(ctx context.Context, id string) error {
	return s.repo.DeleteExperience(ctx, id)
}

func (s *Service) Honors(ctx context.Context, includeDrafts bool) ([]model.Honor, error) {
	return s.repo.Honors(ctx, includeDrafts)
}

func (s *Service) HonorByID(ctx context.Context, id string) (*model.Honor, error) {
	return s.repo.HonorByID(ctx, id)
}

func (s *Service) UpsertHonor(ctx context.Context, next model.Honor) (model.Honor, error) {
	return s.repo.UpsertHonor(ctx, next)
}

func (s *Service) DeleteHonor(ctx context.Context, id string) error {
	return s.repo.DeleteHonor(ctx, id)
}

func (s *Service) Education(ctx context.Context) ([]model.Education, error) {
	return s.repo.Education(ctx)
}

func (s *Service) Timeline(ctx context.Context) ([]model.TimelineEvent, error) {
	return s.repo.Timeline(ctx)
}

func (s *Service) Stats(ctx context.Context) (ContentStats, error) {
	return s.repo.Stats(ctx)
}
