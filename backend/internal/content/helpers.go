package content

import (
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/guts-yang/hello-gutsyang/backend/internal/model"
)

func cloneProjects(items []model.Project) []model.Project {
	out := append([]model.Project(nil), items...)
	sortProjects(out)
	return out
}

func publishedProjects(items []model.Project) []model.Project {
	out := make([]model.Project, 0, len(items))
	for _, item := range items {
		if item.IsPublished {
			out = append(out, item)
		}
	}
	sortProjects(out)
	return out
}

func sortProjects(items []model.Project) {
	slices.SortFunc(items, func(a, b model.Project) int {
		if a.DisplayOrder != b.DisplayOrder {
			return b.DisplayOrder - a.DisplayOrder
		}
		return strings.Compare(b.StartedAt, a.StartedAt)
	})
}

func cloneExperiences(items []model.Experience) []model.Experience {
	out := append([]model.Experience(nil), items...)
	sortExperiences(out)
	return out
}

func publishedExperiences(items []model.Experience) []model.Experience {
	out := make([]model.Experience, 0, len(items))
	for _, item := range items {
		if item.IsPublished {
			out = append(out, item)
		}
	}
	sortExperiences(out)
	return out
}

func sortExperiences(items []model.Experience) {
	slices.SortFunc(items, func(a, b model.Experience) int {
		if a.DisplayOrder != b.DisplayOrder {
			return b.DisplayOrder - a.DisplayOrder
		}
		return strings.Compare(b.StartedAt, a.StartedAt)
	})
}

func cloneHonors(items []model.Honor) []model.Honor {
	out := append([]model.Honor(nil), items...)
	sortHonors(out)
	return out
}

func publishedHonors(items []model.Honor) []model.Honor {
	out := make([]model.Honor, 0, len(items))
	for _, item := range items {
		if item.IsPublished {
			out = append(out, item)
		}
	}
	sortHonors(out)
	return out
}

func sortHonors(items []model.Honor) {
	slices.SortFunc(items, func(a, b model.Honor) int { return b.DisplayOrder - a.DisplayOrder })
}

func cloneEducation(items []model.Education) []model.Education {
	out := append([]model.Education(nil), items...)
	slices.SortFunc(out, func(a, b model.Education) int { return b.DisplayOrder - a.DisplayOrder })
	return out
}

func cloneTimeline(items []model.TimelineEvent) []model.TimelineEvent {
	out := append([]model.TimelineEvent(nil), items...)
	slices.SortFunc(out, func(a, b model.TimelineEvent) int { return strings.Compare(a.Date, b.Date) })
	return out
}

// stableEntityUUID maps legacy string ids from content.json to deterministic UUIDs.
func stableEntityUUID(kind, id string) uuid.UUID {
	if u, err := uuid.Parse(id); err == nil {
		return u
	}
	return uuid.NewSHA1(uuid.NameSpaceURL, []byte("hello-gutsyang:"+kind+":"+id))
}

func entityIDString(kind string, id uuid.UUID) string {
	return id.String()
}

func parseContentDate(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, fmt.Errorf("empty date")
	}
	for _, layout := range []string{"2006-01-02", "2006-01", "2006"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unsupported date %q", s)
}

func formatContentDate(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	if t.Day() == 1 && t.Hour() == 0 {
		return t.Format("2006-01")
	}
	return t.Format("2006-01-02")
}

func optionalDatePtr(s string) (*time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, nil
	}
	t, err := parseContentDate(s)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func derefDate(t *time.Time) string {
	if t == nil || t.IsZero() {
		return ""
	}
	return formatContentDate(*t)
}
