package content

import (
	"context"

	"github.com/guts-yang/hello-gutsyang/backend/internal/model"
)

// ContentStats holds lightweight counts for the admin dashboard.
type ContentStats struct {
	Projects    int `json:"projects"`
	Experiences int `json:"experiences"`
	Honors      int `json:"honors"`
}

// Repo persists CMS entities. Implementations: file snapshot or Postgres.
type Repo interface {
	Home(ctx context.Context) (model.HomeContent, error)
	Snapshot(ctx context.Context) (model.ContentSnapshot, error)
	ImportSnapshot(ctx context.Context, snap model.ContentSnapshot) error

	Profile(ctx context.Context) (model.Profile, error)
	UpdateProfile(ctx context.Context, next model.Profile) (model.Profile, error)

	Projects(ctx context.Context, includeDrafts bool) ([]model.Project, error)
	ProjectBySlug(ctx context.Context, slug string) (*model.Project, error)
	ProjectByID(ctx context.Context, id string) (*model.Project, error)
	UpsertProject(ctx context.Context, next model.Project) (model.Project, error)
	DeleteProject(ctx context.Context, id string) error

	Experiences(ctx context.Context, includeDrafts bool) ([]model.Experience, error)
	ExperienceBySlug(ctx context.Context, slug string) (*model.Experience, error)
	ExperienceByID(ctx context.Context, id string) (*model.Experience, error)
	UpsertExperience(ctx context.Context, next model.Experience) (model.Experience, error)
	DeleteExperience(ctx context.Context, id string) error

	Honors(ctx context.Context, includeDrafts bool) ([]model.Honor, error)
	HonorByID(ctx context.Context, id string) (*model.Honor, error)
	UpsertHonor(ctx context.Context, next model.Honor) (model.Honor, error)
	DeleteHonor(ctx context.Context, id string) error

	Education(ctx context.Context) ([]model.Education, error)
	Timeline(ctx context.Context) ([]model.TimelineEvent, error)

	Stats(ctx context.Context) (ContentStats, error)
}
