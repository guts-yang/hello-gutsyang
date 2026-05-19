package content

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/guts-yang/hello-gutsyang/backend/internal/model"
)

// fileRepo stores the CMS snapshot in content.json (dev fallback without Postgres).
type fileRepo struct {
	mu       sync.RWMutex
	filePath string
	data     model.ContentSnapshot
}

func newFileRepo(dataDir string) (*fileRepo, error) {
	filePath := filepath.Join(dataDir, "content.json")
	r := &fileRepo{filePath: filePath}
	if err := r.load(); err != nil {
		return nil, err
	}
	return r, nil
}

func (r *fileRepo) load() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if err := os.MkdirAll(filepath.Dir(r.filePath), 0o755); err != nil {
		return err
	}

	if _, err := os.Stat(r.filePath); errors.Is(err, os.ErrNotExist) {
		r.data = seedSnapshot()
		return r.persistLocked()
	}

	raw, err := os.ReadFile(r.filePath)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(raw, &r.data); err != nil {
		return fmt.Errorf("decode content snapshot: %w", err)
	}
	return nil
}

func (r *fileRepo) persistLocked() error {
	body, err := json.MarshalIndent(r.data, "", "  ")
	if err != nil {
		return err
	}
	tmp := r.filePath + ".tmp"
	if err := os.WriteFile(tmp, body, 0o600); err != nil {
		return err
	}
	if err := os.Rename(tmp, r.filePath); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}

func (r *fileRepo) Home(ctx context.Context) (model.HomeContent, error) {
	if err := ctx.Err(); err != nil {
		return model.HomeContent{}, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	return model.HomeContent{
		Profile:     r.data.Profile,
		Projects:    publishedProjects(r.data.Projects),
		Experiences: publishedExperiences(r.data.Experiences),
		Honors:      publishedHonors(r.data.Honors),
		Education:   cloneEducation(r.data.Education),
		Timeline:    cloneTimeline(r.data.Timeline),
	}, nil
}

func (r *fileRepo) Snapshot(ctx context.Context) (model.ContentSnapshot, error) {
	if err := ctx.Err(); err != nil {
		return model.ContentSnapshot{}, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.data, nil
}

func (r *fileRepo) ImportSnapshot(ctx context.Context, snap model.ContentSnapshot) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.data = snap
	return r.persistLocked()
}

func (r *fileRepo) Profile(ctx context.Context) (model.Profile, error) {
	if err := ctx.Err(); err != nil {
		return model.Profile{}, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.data.Profile, nil
}

func (r *fileRepo) UpdateProfile(ctx context.Context, next model.Profile) (model.Profile, error) {
	if err := ctx.Err(); err != nil {
		return model.Profile{}, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	next.ID = "main"
	next.UpdatedAt = time.Now().UTC()
	r.data.Profile = next
	if err := r.persistLocked(); err != nil {
		return model.Profile{}, err
	}
	return next, nil
}

func (r *fileRepo) Projects(ctx context.Context, includeDrafts bool) ([]model.Project, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	if includeDrafts {
		return cloneProjects(r.data.Projects), nil
	}
	return publishedProjects(r.data.Projects), nil
}

func (r *fileRepo) ProjectBySlug(ctx context.Context, slug string) (*model.Project, error) {
	projects, err := r.Projects(ctx, false)
	if err != nil {
		return nil, err
	}
	for i := range projects {
		if projects[i].Slug == slug {
			p := projects[i]
			return &p, nil
		}
	}
	return nil, nil
}

func (r *fileRepo) ProjectByID(ctx context.Context, id string) (*model.Project, error) {
	projects, err := r.Projects(ctx, true)
	if err != nil {
		return nil, err
	}
	for i := range projects {
		if projects[i].ID == id {
			p := projects[i]
			return &p, nil
		}
	}
	return nil, nil
}

func (r *fileRepo) UpsertProject(ctx context.Context, next model.Project) (model.Project, error) {
	if err := ctx.Err(); err != nil {
		return model.Project{}, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if next.ID == "" {
		next.ID = randomID()
	}
	next.Slug = strings.TrimSpace(next.Slug)
	inserted := false
	for i := range r.data.Projects {
		if r.data.Projects[i].ID == next.ID {
			r.data.Projects[i] = next
			inserted = true
			break
		}
	}
	if !inserted {
		r.data.Projects = append(r.data.Projects, next)
	}
	sortProjects(r.data.Projects)
	if err := r.persistLocked(); err != nil {
		return model.Project{}, err
	}
	return next, nil
}

func (r *fileRepo) DeleteProject(ctx context.Context, id string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.data.Projects = slices.DeleteFunc(r.data.Projects, func(item model.Project) bool { return item.ID == id })
	return r.persistLocked()
}

func (r *fileRepo) Experiences(ctx context.Context, includeDrafts bool) ([]model.Experience, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	if includeDrafts {
		return cloneExperiences(r.data.Experiences), nil
	}
	return publishedExperiences(r.data.Experiences), nil
}

func (r *fileRepo) ExperienceBySlug(ctx context.Context, slug string) (*model.Experience, error) {
	items, err := r.Experiences(ctx, false)
	if err != nil {
		return nil, err
	}
	for i := range items {
		if items[i].Slug == slug {
			item := items[i]
			return &item, nil
		}
	}
	return nil, nil
}

func (r *fileRepo) ExperienceByID(ctx context.Context, id string) (*model.Experience, error) {
	items, err := r.Experiences(ctx, true)
	if err != nil {
		return nil, err
	}
	for i := range items {
		if items[i].ID == id {
			item := items[i]
			return &item, nil
		}
	}
	return nil, nil
}

func (r *fileRepo) UpsertExperience(ctx context.Context, next model.Experience) (model.Experience, error) {
	if err := ctx.Err(); err != nil {
		return model.Experience{}, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if next.ID == "" {
		next.ID = randomID()
	}
	inserted := false
	for i := range r.data.Experiences {
		if r.data.Experiences[i].ID == next.ID {
			r.data.Experiences[i] = next
			inserted = true
			break
		}
	}
	if !inserted {
		r.data.Experiences = append(r.data.Experiences, next)
	}
	sortExperiences(r.data.Experiences)
	if err := r.persistLocked(); err != nil {
		return model.Experience{}, err
	}
	return next, nil
}

func (r *fileRepo) DeleteExperience(ctx context.Context, id string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.data.Experiences = slices.DeleteFunc(r.data.Experiences, func(item model.Experience) bool { return item.ID == id })
	return r.persistLocked()
}

func (r *fileRepo) Honors(ctx context.Context, includeDrafts bool) ([]model.Honor, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	if includeDrafts {
		return cloneHonors(r.data.Honors), nil
	}
	return publishedHonors(r.data.Honors), nil
}

func (r *fileRepo) HonorByID(ctx context.Context, id string) (*model.Honor, error) {
	items, err := r.Honors(ctx, true)
	if err != nil {
		return nil, err
	}
	for i := range items {
		if items[i].ID == id {
			item := items[i]
			return &item, nil
		}
	}
	return nil, nil
}

func (r *fileRepo) UpsertHonor(ctx context.Context, next model.Honor) (model.Honor, error) {
	if err := ctx.Err(); err != nil {
		return model.Honor{}, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if next.ID == "" {
		next.ID = randomID()
	}
	inserted := false
	for i := range r.data.Honors {
		if r.data.Honors[i].ID == next.ID {
			r.data.Honors[i] = next
			inserted = true
			break
		}
	}
	if !inserted {
		r.data.Honors = append(r.data.Honors, next)
	}
	sortHonors(r.data.Honors)
	if err := r.persistLocked(); err != nil {
		return model.Honor{}, err
	}
	return next, nil
}

func (r *fileRepo) DeleteHonor(ctx context.Context, id string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.data.Honors = slices.DeleteFunc(r.data.Honors, func(item model.Honor) bool { return item.ID == id })
	return r.persistLocked()
}

func (r *fileRepo) Education(ctx context.Context) ([]model.Education, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	return cloneEducation(r.data.Education), nil
}

func (r *fileRepo) Timeline(ctx context.Context) ([]model.TimelineEvent, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	return cloneTimeline(r.data.Timeline), nil
}

func (r *fileRepo) Stats(ctx context.Context) (ContentStats, error) {
	if err := ctx.Err(); err != nil {
		return ContentStats{}, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	return ContentStats{
		Projects:    len(r.data.Projects),
		Experiences: len(r.data.Experiences),
		Honors:      len(r.data.Honors),
	}, nil
}

func randomID() string {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buf)
}
